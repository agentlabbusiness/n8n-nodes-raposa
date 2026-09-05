import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class RaposaApi implements ICredentialType {
	name = 'raposaApi';

	icon: Icon = { light: 'file:raposa.svg', dark: 'file:raposa.dark.svg' };

	displayName = 'Raposa API';

	documentationUrl = 'https://raposa.group/docs/';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://dcescrypt.com/api',
			description: 'API host. Keep the default unless you run a private Raposa install.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Client key from your Raposa account. Stored only as a hash on the Raposa side.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// GET /v1/me returns the caller's own plan and quota — the cheapest call that proves the key.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/me',
		},
	};
}
