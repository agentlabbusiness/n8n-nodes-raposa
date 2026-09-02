// Behaviour of the compiled node against a fake Raposa API — no network, no n8n runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Raposa } = require('../dist/nodes/Raposa/Raposa.node.js');
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
	const ops = d.properties.find((p) => p.name === 'operation').options.map((o) => o.value);
	assert.deepEqual(ops.sort(), ['create', 'get', 'wait']);
});

test('create posts the approval body and returns the id without polling', async () => {
	const ctx = makeContext({
		params: { operation: 'create', action: 'refund #1', context: 'why', risk: 'high', requestedBy: 'agent-1', webhookUrl: 'https://hook.example/x' },
		responses: [{ id: 'ap_1', status: 'pending' }],
	});
	const [out] = await new Raposa().execute.call(ctx);
	assert.equal(out[0].json.id, 'ap_1');
	assert.equal(ctx.calls.length, 1);
	assert.equal(ctx.calls[0].method, 'POST');
	assert.equal(ctx.calls[0].url, 'https://example.test/api/v1/approvals');
	assert.equal(ctx.calls[0].body.webhook_url, 'https://hook.example/x');
	assert.equal(ctx.calls[0].body.requested_by, 'agent-1');
});

test('wait polls until approved and returns the decided record', async () => {
	const ctx = makeContext({
		params: { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, pollSeconds: 2, failOnReject: true },
		responses: [{ id: 'ap_2', status: 'pending' }, { id: 'ap_2', status: 'pending' }, { id: 'ap_2', status: 'approved' }],
	});
	// shrink the poll interval so the test does not actually sleep 2s per round
	ctx.getNodeParameter = (name, _i, fb) => (name === 'pollSeconds' ? 0.01 : ({ operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1, failOnReject: true })[name] ?? fb);
	const [out] = await new Raposa().execute.call(ctx);
	assert.equal(out[0].json.status, 'approved');
	assert.equal(ctx.calls.length, 3);
	assert.equal(ctx.calls[1].method, 'GET');
	assert.match(ctx.calls[1].url, /\/v1\/approvals\/ap_2$/);
});

test('wait fails on reject by default and passes rejection through when asked', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', timeoutMinutes: 1 };
	const rejecting = () => makeContext({ params: base, responses: [{ id: 'ap_3', status: 'rejected' }] });

	const strict = rejecting();
	strict.getNodeParameter = (name, _i, fb) => (name === 'failOnReject' ? true : name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	await assert.rejects(() => new Raposa().execute.call(strict), /rejected by a human/);

	const lenient = rejecting();
	lenient.getNodeParameter = (name, _i, fb) => (name === 'failOnReject' ? false : name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	const [out] = await new Raposa().execute.call(lenient);
	assert.equal(out[0].json.status, 'rejected');
});

test('wait never treats silence as approval: timeout throws', async () => {
	const base = { operation: 'wait', action: 'a', context: 'c', risk: 'low', requestedBy: 'n8n', failOnReject: true };
	const ctx = makeContext({ params: base, responses: [{ id: 'ap_4', status: 'pending' }] });
	ctx.getNodeParameter = (name, _i, fb) => (name === 'timeoutMinutes' ? 0.0005 : name === 'pollSeconds' ? 0.01 : base[name] ?? fb);
	await assert.rejects(() => new Raposa().execute.call(ctx), /not decided within/);
});
