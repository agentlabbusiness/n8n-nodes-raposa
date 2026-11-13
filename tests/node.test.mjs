// Behaviour of the compiled node against a fake Raposa API — no network, no n8n runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { Raposa, configuredOutputs } = require('../dist/nodes/Raposa/Raposa.node.js');
const { RaposaApi } = require('../dist/credentials/RaposaApi.credentials.js');

// Minimal stand-in for IExecuteFunctions: parameters per item + scripted HTTP responses.
function makeContext({ params, responses }) {
	const calls = [];
	let n = 0;
	return {
		calls,
		getInputData: () => [{ json: {} }],
		getNode: () => ({ name: 'Raposa Approval' }),
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getCredentials: async () => ({ baseUrl: 'https://example.test/api/', apiKey: 'k' }),
		helpers: {
			httpRequestWithAuthentication: async function (_cred, options) {
				calls.push(options);
				const r = responses[Math.min(n, responses.length - 1)];
				n += 1;
				if (r instanceof Error) throw r;
				return r;
			},
		},
	};
}

test('credential declares bearer auth and a /v1/me test call', () => {
	const c = new RaposaApi();
	assert.equal(c.name, 'raposaApi');
	assert.match(c.authenticate.properties.headers.Authorization, /Bearer/);
	assert.equal(c.test.request.url, '/v1/me');
});

test('node description lists the three operations and requires the credential', () => {
	const d = new Raposa().description;
	assert.equal(d.name, 'raposa');
	assert.deepEqual(d.credentials, [{ name: 'raposaApi', required: true }]);
	assert.deepEqual(configuredOutputs({ operation: 'wait' }), [
		{ type: 'main', displayName: 'Approved / Success' },
		{ type: 'main', displayName: 'Not Approved' },
	]);
	assert.deepEqual(configuredOutputs({ operation: 'create' }), [
		{ type: 'main', displayName: 'API Result' },
	]);
	const ops = d.properties.find((p) => p.name === 'operation').options.map((o) => o.value);
	assert.deepEqual(ops.sort(), ['create', 'get', 'wait']);
});

test('published example workflow keeps its protected action on Wait output 0', () => {
	const workflow = JSON.parse(
		readFileSync(new URL('../docs/example-workflow.json', import.meta.url), 'utf8'),
	);
	const raposa = workflow.nodes.find((node) => node.type === 'n8n-nodes-raposa.raposa');
	assert.equal(raposa.parameters.operation, 'wait');
	assert.equal(raposa.typeVersion, 1);
	assert.equal(workflow.connections[raposa.name].main[0][0].index, 0);
	assert.equal(configuredOutputs(raposa.parameters)[0].displayName, 'Approved / Success');
});

test('create posts the approval body and returns the id without polling', async () => {
	const ctx = makeContext({
		params: { operation: 'create', action: 'refund #1', risk: 'high', additionalFields: { context: 'why', requestedBy: 'agent-1', webhookUrl: 'https://hook.example/x' } },
		responses: [{ id: 'ap_1', status: 'pending' }],
	});
	const [apiResult] = await new Raposa().execute.call(ctx);
	assert.equal(apiResult[0].json.id, 'ap_1');
	assert.equal(ctx.calls.length, 1);
	assert.equal(ctx.calls[0].method, 'POST');
	assert.equal(ctx.calls[0].url, 'https://example.test/api/v1/approvals');
	assert.equal(ctx.calls[0].body.webhook_url, 'https://hook.example/x');
	assert.equal(ctx.calls[0].body.requested_by, 'agent-1');
	assert.equal(ctx.calls[0].body.context, 'why');
});

test('get routes every known status only to the neutral API Result output', async () => {
	for (const status of ['pending', 'approved', 'rejected', 'expired']) {
		const id = `ap_get_${status}`;
		const ctx = makeContext({
			params: { operation: 'get', approvalId: id },
			responses: [{ id, status }],
		});
		const [apiResult] = await new Raposa().execute.call(ctx);
		assert.equal(apiResult[0].json.status, status);
	}
});

test('create without Additional Fields still sends a non-empty context (API min_length=1)', async () => {
	const ctx = makeContext({
		params: { operation: 'create', action: 'refund #2', risk: 'low' },
		responses: [{ id: 'ap_2', status: 'pending' }],
	});
	await new Raposa().execute.call(ctx);
	assert.equal(ctx.calls[0].body.context, 'refund #2');
	assert.equal(ctx.calls[0].body.requested_by, 'n8n');
	assert.equal('webhook_url' in ctx.calls[0].body, false);
});

// From 0.1.6 "Ask and Wait" first calls GET /v1/approvers so an account with no
// approver fails fast instead of hanging to timeout. A populated preflight
// response therefore leads every wait scenario below.
const HAS_APPROVER = { approvers: [{ user: 'owner-1', email: 'a@b.io' }] };

test('wait polls until approved and returns the decided record', async () => {
	const ctx = makeContext({
		params: { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, pollSeconds: 2, failOnReject: true },
		responses: [HAS_APPROVER, { id: 'ap_2', status: 'pending' }, { id: 'ap_2', status: 'pending' }, { id: 'ap_2', status: 'approved' }],
	});
	// shrink the poll interval so the test does not actually sleep 2s per round
	ctx.getNodeParameter = (name, _i, fb) => (name === 'pollSeconds' ? 0.01 : ({ operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, failOnReject: true })[name] ?? fb);
	const [out] = await new Raposa().execute.call(ctx);
	assert.equal(out[0].json.status, 'approved');
	assert.equal(ctx.calls.length, 4);
	assert.equal(ctx.calls[0].method, 'GET');
	assert.match(ctx.calls[0].url, /\/v1\/approvers$/);
	assert.equal(ctx.calls[1].method, 'POST');
	assert.match(ctx.calls[1].url, /\/v1\/approvals$/);
	assert.equal(ctx.calls[2].method, 'GET');
	assert.match(ctx.calls[2].url, /\/v1\/approvals\/ap_2$/);
});

test('wait fails on reject by default and passes rejection through when asked', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1 };
	const rejecting = () => makeContext({ params: base, responses: [HAS_APPROVER, { id: 'ap_3', status: 'rejected' }] });

	const strict = rejecting();
	strict.getNodeParameter = (name, _i, fb) => (name === 'failOnReject' ? true : name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	await assert.rejects(() => new Raposa().execute.call(strict), /rejected by a human/);

	const lenient = rejecting();
	lenient.getNodeParameter = (name, _i, fb) => (name === 'failOnReject' ? false : name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	const [approved, notApproved] = await new Raposa().execute.call(lenient);
	assert.equal(approved.length, 0);
	assert.equal(notApproved[0].json.status, 'rejected');
});

test('wait never lets an expired approval reach the guarded output', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, failOnReject: true };
	const ctx = makeContext({ params: base, responses: [HAS_APPROVER, { id: 'ap_expired', status: 'expired' }] });
	ctx.getNodeParameter = (name, _i, fb) => (name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	await assert.rejects(() => new Raposa().execute.call(ctx), /expired without approval/);
});

test('wait remains fail-closed when preflight errors and the approval later expires', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, failOnReject: true };
	const ctx = makeContext({
		params: base,
		responses: [
			new Error('approvers endpoint down'),
			{ id: 'ap_expired_after_preflight', status: 'pending' },
			{ id: 'ap_expired_after_preflight', status: 'expired' },
		],
	});
	ctx.getNodeParameter = (name, _i, fb) => (name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	await assert.rejects(() => new Raposa().execute.call(ctx), /expired without approval/);
});

test('wait rejects unknown, missing, and mismatched approval responses', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, failOnReject: true };
	const cases = [
		{
			name: 'unknown status',
			responses: [HAS_APPROVER, { id: 'ap_unknown', status: 'pending' }, { id: 'ap_unknown', status: 'cancelled' }],
			message: /unknown approval status/,
		},
		{
			name: 'missing status',
			responses: [HAS_APPROVER, { id: 'ap_missing_status' }],
			message: /unknown approval status/,
		},
		{
			name: 'missing id',
			responses: [HAS_APPROVER, { status: 'pending' }],
			message: /without a valid ID/,
		},
		{
			name: 'different id while polling',
			responses: [HAS_APPROVER, { id: 'ap_expected', status: 'pending' }, { id: 'ap_other', status: 'approved' }],
			message: /while waiting for ap_expected/,
		},
	];

	for (const testCase of cases) {
		const ctx = makeContext({ params: base, responses: testCase.responses });
		ctx.getNodeParameter = (name, _i, fb) => (name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
		await assert.rejects(
			() => new Raposa().execute.call(ctx),
			testCase.message,
			testCase.name,
		);
	}
});

test('wait never treats silence as approval: timeout throws', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', failOnReject: true };
	const ctx = makeContext({ params: base, responses: [HAS_APPROVER, { id: 'ap_4', status: 'pending' }] });
	ctx.getNodeParameter = (name, _i, fb) => (name === 'timeoutMinutes' ? 0.0005 : name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	await assert.rejects(() => new Raposa().execute.call(ctx), /not decided within/);
});

test('wait fails fast with a clear message when the account has no approver', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 60, failOnReject: true };
	const ctx = makeContext({ params: base, responses: [{ approvers: [] }] });
	ctx.getNodeParameter = (name, _i, fb) => (name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	await assert.rejects(() => new Raposa().execute.call(ctx), /No approver is configured/);
	// It never created a doomed approval: only the preflight GET happened.
	assert.equal(ctx.calls.length, 1);
	assert.match(ctx.calls[0].url, /\/v1\/approvers$/);
});

test('wait keeps the preflight advisory but still requires an approved decision', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, failOnReject: true };
	// First call (preflight) errors; only the later exact approval reaches output 0.
	const ctx = makeContext({ params: base, responses: [new Error('approvers endpoint down'), { id: 'ap_5', status: 'approved' }] });
	ctx.getNodeParameter = (name, _i, fb) => (name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	const [out] = await new Raposa().execute.call(ctx);
	assert.equal(out[0].json.status, 'approved');
	assert.equal(ctx.calls[1].method, 'POST');
});
