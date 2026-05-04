import { isPrivateStore, recordIdentifierFor } from '@warp-drive/core/store/-private';
import type { ResourceKey } from '@warp-drive/core/types';
import type { Type } from '@warp-drive/core/types/symbols';
import { module, test } from '@warp-drive/diagnostic';
import { JSONAPICache } from '@warp-drive/json-api';
import { useLegacyStore } from '@warp-drive/legacy';
import { withDefaults } from '@warp-drive/legacy/model/migration-support';

const ChannelMailSchema = withDefaults({
  type: 'mail',
  fields: [{ kind: 'field', name: 'name' }],
});

const ChannelSmsSchema = withDefaults({
  type: 'sms',
  fields: [{ kind: 'field', name: 'name' }],
});

const MessageSchema = withDefaults({
  type: 'message',
  fields: [
    { kind: 'field', name: 'name' },
    {
      kind: 'belongsTo',
      type: 'channel',
      name: 'channel',
      options: { inverse: null, async: false, polymorphic: true },
    },
  ],
});

type ChannelMail = {
  [Type]: 'mail';
  name: string;
};

type ChannelSms = {
  [Type]: 'sms';
  name: string;
};

type Message = {
  [Type]: 'message';
  name: string | null;
  channel: ChannelMail | ChannelSms | null;
};

const TestStore = useLegacyStore({
  cache: JSONAPICache,
  linksMode: false,
  schemas: [ChannelMailSchema, ChannelSmsSchema, MessageSchema],
});

type TestStore = InstanceType<typeof TestStore>;

module('<JSONAPICache>.getRemoteRelationship w/ polymorphic relationship', function () {
  test('returns the correct remote relationship data for a clean belongsTo (null)', function (assert) {
    const store = isPrivateStore(new TestStore());
    const cache = store.cache;
    const message = store.push<Message>({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          name: 'Message from John',
        },
        relationships: {
          channel: {
            data: null,
          },
        },
      },
    });

    const state = cache.getRemoteRelationship(recordIdentifierFor(message), 'channel');
    assert.equal(state?.data, null, 'The cache value is defined as null');
    assert.deepEqual(
      state,
      {
        data: null,
      },
      'The cache value does not have extra properties'
    );
  });

  test('returns the correct remote relationship data for a never-set belongsTo (undefined)', function (assert) {
    const store = isPrivateStore(new TestStore());
    const cache = store.cache;
    const message = store.push<Message>({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          name: 'Message from John',
        },
        relationships: {
          channel: { links: { related: '/messages/1/relationships/channel' } },
        },
      },
    });

    const key = recordIdentifierFor(message);
    const state = cache.getRemoteRelationship(key, 'channel');
    assert.false('data' in state, 'The cache value does not have a data property');
    assert.deepEqual(
      state,
      {
        links: {
          related: '/messages/1/relationships/channel',
        },
      },
      'The cache value does not have extra properties'
    );
  });

  test('returns the correct remote relationship data for a clean belongsTo (has value)', function (assert) {
    const store = isPrivateStore(new TestStore());
    const cache = store.cache;
    const message = store.push<Message>({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          name: 'Message from John',
        },
        relationships: {
          channel: {
            data: {
              id: '2',
              type: 'mail',
            },
          },
        },
      },
      included: [
        {
          id: '2',
          type: 'mail',
          attributes: {
            name: 'Kevins inbox',
          },
        },
      ],
    });

    const state = cache.getRemoteRelationship(recordIdentifierFor(message), 'channel');
    assert.deepEqual(
      state?.data,
      { id: '2', type: 'mail', lid: '@lid:mail-2' } as ResourceKey,
      'The cache value is present'
    );
    assert.deepEqual(
      state,
      {
        data: { id: '2', type: 'mail', lid: '@lid:mail-2' } as ResourceKey,
      },
      'The cache value does not have extra properties'
    );
  });

  test('returns the correct remote relationship data for a dirty belongsTo (originally null)', function (assert) {
    const store = isPrivateStore(new TestStore());
    const cache = store.cache;
    const message = store.push<Message>({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          name: 'Message from John',
        },
        relationships: {
          channel: {
            data: null,
          },
        },
      },
    });
    const channel = store.push<ChannelMail>({
      data: {
        id: '2',
        type: 'mail',
        attributes: {
          name: 'Kevins mailbox',
        },
      },
    });
    message.channel = channel;

    const state = cache.getRemoteRelationship(recordIdentifierFor(message), 'channel');
    assert.equal(state?.data, null, 'The cache value is defined as null');
    assert.deepEqual(
      state,
      {
        data: null,
      },
      'The cache value does not have extra properties'
    );
  });

  test('returns the correct remote relationship data for a dirty never-set belongsTo (originally undefined)', function (assert) {
    const store = isPrivateStore(new TestStore());
    const cache = store.cache;
    const message = store.push<Message>({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          name: 'Message from John',
        },
        relationships: {
          channel: { links: { related: '/messages/1/relationships/channel' } },
        },
      },
    });
    const sms = store.push<ChannelSms>({
      data: {
        id: '2',
        type: 'sms',
        attributes: {
          name: 'Janes phone inbox',
        },
      },
    });
    message.channel = sms;

    const key = recordIdentifierFor(message);
    const state = cache.getRemoteRelationship(key, 'channel');
    assert.false('data' in state, 'The cache value does not have a data property');
    assert.deepEqual(
      state,
      {
        links: {
          related: '/messages/1/relationships/channel',
        },
      },
      'The cache value does not have extra properties'
    );
  });

  test('returns the correct remote relationship data for a dirty belongsTo (originally different value)', function (assert) {
    const store = isPrivateStore(new TestStore());
    const cache = store.cache;
    const message = store.push<Message>({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          name: 'Message from John',
        },
        relationships: {
          channel: {
            data: {
              id: '2',
              type: 'sms',
            },
          },
        },
      },
      included: [
        {
          id: '2',
          type: 'sms',
          attributes: {
            name: 'Janes phone inbox',
          },
        },
      ],
    });

    const mail = store.push<ChannelMail>({
      data: {
        id: '3',
        type: 'mail',
        attributes: {
          name: 'Kevins inbox',
        },
      },
    });
    message.channel = mail;

    const state = cache.getRemoteRelationship(recordIdentifierFor(message), 'channel');
    assert.deepEqual(
      state?.data,
      { id: '2', type: 'sms', lid: '@lid:sms-2' } as ResourceKey,
      'The cache value is present'
    );
    assert.deepEqual(
      state,
      {
        data: { id: '2', type: 'sms', lid: '@lid:sms-2' } as ResourceKey,
      },
      'The cache value does not have extra properties'
    );
  });

  test('returns the correct remote relationship data for a dirty belongsTo (originally had value, now null)', function (assert) {
    const store = isPrivateStore(new TestStore());
    const cache = store.cache;
    const message = store.push<Message>({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          name: 'Message from John',
        },
        relationships: {
          channel: {
            data: {
              id: '2',
              type: 'mail',
            },
          },
        },
      },
      included: [
        {
          id: '2',
          type: 'mail',
          attributes: {
            name: 'Kevins inbox',
          },
        },
      ],
    });
    message.channel = null;

    const state = cache.getRemoteRelationship(recordIdentifierFor(message), 'channel');
    assert.deepEqual(
      state?.data,
      { id: '2', type: 'mail', lid: '@lid:mail-2' } as ResourceKey,
      'The cache value is present'
    );
    assert.deepEqual(
      state,
      {
        data: { id: '2', type: 'mail', lid: '@lid:mail-2' } as ResourceKey,
      },
      'The cache value does not have extra properties'
    );
  });
});
