import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

type Approval = {
	id: string;
	status: 'pending' | 'approved' | 'rejected' | string;
	[key: string]: unknown;
};

export class Raposa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Raposa Approval',
		name: 'raposa',
		icon: { light: 'file:raposa.svg', dark: 'file:raposa.dark.svg' },
		group: ['transform'],
		version: 1,
		usableAsTool: true,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Pause until an authorised human approves an action; every decision is sealed in a hash-chained audit log',
		defaults: { name: 'Raposa Approval' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'raposaApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Ask and Wait',
						value: 'wait',
						action: 'Create an approval and wait for the human decision',
						description: 'Creates the approval, polls until a human decides or the timeout passes',
					},
					{
						name: 'Create',
						value: 'create',
						action: 'Create an approval request',
						description: 'Creates the approval and returns immediately with its ID (use a webhook to learn the decision)',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get an approval by ID',
					},
				],
				default: 'wait',
			},
			{
				displayName: 'Action',
				name: 'action',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'refund order #4471 — EUR 900',
				description: 'What the agent wants to do, in words a human can decide on',
				displayOptions: { show: { operation: ['wait', 'create'] } },
			},
			{
				displayName: 'Context',
				name: 'context',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Why. Free text the approver sees. Do not put special-category personal data here.',
				displayOptions: { show: { operation: ['wait', 'create'] } },
			},
			{
				displayName: 'Risk',
				name: 'risk',
				type: 'options',
				options: [
					{ name: 'Low', value: 'low' },
					{ name: 'Medium', value: 'medium' },
					{ name: 'High', value: 'high' },
				],
				default: 'medium',
				displayOptions: { show: { operation: ['wait', 'create'] } },
			},
			{
				displayName: 'Requested By',
				name: 'requestedBy',
				type: 'string',
				default: 'n8n',
				description: 'Identifier of the agent or workflow asking',
				displayOptions: { show: { operation: ['wait', 'create'] } },
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				description: 'Optional. Raposa POSTs the decision here, HMAC-signed with your webhook secret.',
				displayOptions: { show: { operation: ['create'] } },
			},
			{
				displayName: 'Approval ID',
				name: 'approvalId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['get'] } },
			},
			{
				displayName: 'Timeout (Minutes)',
				name: 'timeoutMinutes',
				type: 'number',
				default: 60,
				typeOptions: { minValue: 1 },
				description: 'How long to wait for a human. On timeout the node fails: an unanswered request must never count as approval.',
				displayOptions: { show: { operation: ['wait'] } },
			},
			{
				displayName: 'Poll Every (Seconds)',
				name: 'pollSeconds',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 2 },
				displayOptions: { show: { operation: ['wait'] } },
			},
			{
				displayName: 'Fail on Reject',
				name: 'failOnReject',
				type: 'boolean',
				default: true,
				description:
					'Whether a rejected approval stops the workflow with an error. Turn off to route rejections yourself from the "status" field.',
				displayOptions: { show: { operation: ['wait'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const credentials = (await this.getCredentials('raposaApi')) as { baseUrl: string };
		const baseUrl = String(credentials.baseUrl || 'https://dcescrypt.com/api').replace(/\/+$/, '');

		const request = async (options: IHttpRequestOptions): Promise<IDataObject> => {
			try {
				return (await this.helpers.httpRequestWithAuthentication.call(this, 'raposaApi', {
					json: true,
					...options,
					url: `${baseUrl}${options.url}`,
				})) as IDataObject;
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as never);
			}
		};

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'get') {
				const id = this.getNodeParameter('approvalId', i) as string;
				const approval = await request({ method: 'GET', url: `/v1/approvals/${encodeURIComponent(id)}` });
				out.push({ json: approval, pairedItem: { item: i } });
				continue;
			}

			const body: IDataObject = {
				action: this.getNodeParameter('action', i) as string,
				context: this.getNodeParameter('context', i, '') as string,
				risk: this.getNodeParameter('risk', i) as string,
				requested_by: this.getNodeParameter('requestedBy', i, 'n8n') as string,
			};
			if (operation === 'create') {
				const webhookUrl = this.getNodeParameter('webhookUrl', i, '') as string;
				if (webhookUrl) body.webhook_url = webhookUrl;
			}

			const created = (await request({ method: 'POST', url: '/v1/approvals', body })) as Approval;

			if (operation === 'create') {
				out.push({ json: created as IDataObject, pairedItem: { item: i } });
				continue;
			}

			// wait: poll until a human decides. Silence is not consent — timeout is an error.
			const timeoutMs = (this.getNodeParameter('timeoutMinutes', i) as number) * 60_000;
			const pollMs = (this.getNodeParameter('pollSeconds', i) as number) * 1000;
			const failOnReject = this.getNodeParameter('failOnReject', i) as boolean;
			const deadline = Date.now() + timeoutMs;
			let current: Approval = created;

			while (current.status === 'pending') {
				if (Date.now() >= deadline) {
					throw new NodeOperationError(
						this.getNode(),
						`Raposa approval ${current.id} was not decided within ${timeoutMs / 60_000} minutes — treating as not approved`,
						{ itemIndex: i },
					);
				}
				await sleep(Math.min(pollMs, Math.max(0, deadline - Date.now())));
				current = (await request({
					method: 'GET',
					url: `/v1/approvals/${encodeURIComponent(current.id)}`,
				})) as Approval;
			}

			if (current.status === 'rejected' && failOnReject) {
				throw new NodeOperationError(
					this.getNode(),
					`Raposa approval ${current.id} was rejected by a human`,
					{ itemIndex: i },
				);
			}

			out.push({ json: current as IDataObject, pairedItem: { item: i } });
		}

		return [out];
	}
}
