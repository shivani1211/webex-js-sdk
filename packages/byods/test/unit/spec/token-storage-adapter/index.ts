import {InMemoryTokenStorageAdapter} from '../../../../src/token-storage-adapter';;
import {OrgServiceAppAuthorization} from '../../../../src/types';;

describe('InMemoryTokenStorageAdapter', () => {
  let tokenStorage: InMemoryTokenStorageAdapter;
  const orgId = 'org-123';
  const token: OrgServiceAppAuthorization = {
    orgId,
    serviceAppToken: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      refreshAccessTokenExpiresAt: new Date(Date.now() + 7200 * 1000),
    },
  };

  beforeEach(() => {
    tokenStorage = new InMemoryTokenStorageAdapter();
  });

  test('should store and retrieve a token', async () => {
    await tokenStorage.setToken(orgId, token);
    const retrievedToken = await tokenStorage.getToken(orgId);
    expect(retrievedToken).toEqual(token);
  });

  test('should throw error for a non-existent token', async () => {
    const nonExistentOrgId = 'non-existent-org';
    await expect(tokenStorage.getToken(nonExistentOrgId)).rejects.toThrow(
      `Service App token not found for org ID: ${nonExistentOrgId}`
    );
  });

  test('should list all stored tokens', async () => {
    const dummyOrgId = 'org-456';
    const dummyToken: OrgServiceAppAuthorization = {
      orgId: dummyOrgId,
      serviceAppToken: {
        accessToken: 'another-access-token',
        refreshToken: 'another-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        refreshAccessTokenExpiresAt: new Date(Date.now() + 7200 * 1000),
      },
    };

    await tokenStorage.setToken(orgId, token);
    await tokenStorage.setToken(dummyOrgId, dummyToken);

    const tokens = await tokenStorage.listTokens();
    expect(tokens).toContain(token);
    expect(tokens).toContain(dummyToken);
  });

  test('should delete a token for a given orgId', async () => {
    await tokenStorage.setToken(orgId, token);
    await tokenStorage.deleteToken(orgId);

    await expect(tokenStorage.getToken(orgId)).rejects.toThrow(
      `Service App token not found for org ID: ${orgId}`
    );
  });

  test('should reset all tokens', async () => {
    const dummyOrgId = 'org-456';
    const dummyToken: OrgServiceAppAuthorization = {
      orgId: dummyOrgId,
      serviceAppToken: {
        accessToken: 'another-access-token',
        refreshToken: 'another-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        refreshAccessTokenExpiresAt: new Date(Date.now() + 7200 * 1000),
      },
    };

    await tokenStorage.setToken(orgId, token);
    await tokenStorage.setToken(dummyOrgId, dummyToken);

    await tokenStorage.resetTokens();

    const tokens = await tokenStorage.listTokens();
    expect(tokens.length).toEqual(0);
  });

  test('should handle concurrent token operations', async () => {
    const operations = Array(10).fill(null).map((_, index) => ({
      orgId: `org-${index}`,
      token: {
        orgId: `org-${index}`,
        serviceAppToken: {
          accessToken: `access-token-${index}`,
          refreshToken: `refresh-token-${index}`,
          expiresAt: new Date('2025-02-15T11:00:00Z'),
          refreshAccessTokenExpiresAt: new Date('2025-02-15T12:00:00Z'),
        },
      },
    }));
    await Promise.all([
      ...operations.map(({orgId, token}) => tokenStorage.setToken(orgId, token)),
      ...operations.map(({orgId}) => tokenStorage.getToken(orgId).catch(() => null)),
      tokenStorage.listTokens(),
    ]);
    const finalTokens = await tokenStorage.listTokens();
    expect(finalTokens.length).toBe(operations.length);
  });
});
