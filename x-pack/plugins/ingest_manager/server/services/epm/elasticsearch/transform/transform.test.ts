/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

jest.mock('../../packages/get', () => {
  return { getInstallation: jest.fn(), getInstallationObject: jest.fn() };
});

jest.mock('./common', () => {
  return {
    getAsset: jest.fn(),
  };
});

import { installTransformForDataset } from './install';
import { ILegacyScopedClusterClient, SavedObject, SavedObjectsClientContract } from 'kibana/server';
import { ElasticsearchAssetType, Installation, RegistryPackage } from '../../../../types';
import { getInstallation, getInstallationObject } from '../../packages';
import { getAsset } from './common';
// eslint-disable-next-line @kbn/eslint/no-restricted-paths
import { savedObjectsClientMock } from '../../../../../../../../src/core/server/saved_objects/service/saved_objects_client.mock';

describe('test transform install', () => {
  let legacyScopedClusterClient: jest.Mocked<ILegacyScopedClusterClient>;
  let savedObjectsClient: jest.Mocked<SavedObjectsClientContract>;
  beforeEach(() => {
    legacyScopedClusterClient = {
      callAsInternalUser: jest.fn(),
      callAsCurrentUser: jest.fn(),
    };
    (getInstallation as jest.MockedFunction<typeof getInstallation>).mockReset();
    (getInstallationObject as jest.MockedFunction<typeof getInstallationObject>).mockReset();
    savedObjectsClient = savedObjectsClientMock.create();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('can install new versions and removes older version', async () => {
    const previousInstallation: Installation = ({
      installed_es: [
        {
          id: 'metrics-endpoint.policy-0.16.0-dev.0',
          type: ElasticsearchAssetType.ingestPipeline,
        },
        {
          id: 'metrics-endpoint.metadata_current-default-0.15.0-dev.0',
          type: ElasticsearchAssetType.transform,
        },
      ],
    } as unknown) as Installation;

    const currentInstallation: Installation = ({
      installed_es: [
        {
          id: 'metrics-endpoint.policy-0.16.0-dev.0',
          type: ElasticsearchAssetType.ingestPipeline,
        },
        {
          id: 'metrics-endpoint.metadata_current-default-0.15.0-dev.0',
          type: ElasticsearchAssetType.transform,
        },
        {
          id: 'metrics-endpoint.metadata_current-default-0.16.0-dev.0',
          type: ElasticsearchAssetType.transform,
        },
        {
          id: 'metrics-endpoint.metadata-default-0.16.0-dev.0',
          type: ElasticsearchAssetType.transform,
        },
      ],
    } as unknown) as Installation;
    (getAsset as jest.MockedFunction<typeof getAsset>)
      .mockReturnValueOnce(Buffer.from('{"content": "data"}', 'utf8'))
      .mockReturnValueOnce(Buffer.from('{"content": "data"}', 'utf8'));

    (getInstallation as jest.MockedFunction<typeof getInstallation>)
      .mockReturnValueOnce(Promise.resolve(previousInstallation))
      .mockReturnValueOnce(Promise.resolve(currentInstallation));

    (getInstallationObject as jest.MockedFunction<
      typeof getInstallationObject
    >).mockReturnValueOnce(
      Promise.resolve(({
        attributes: {
          installed_es: previousInstallation.installed_es,
        },
      } as unknown) as SavedObject<Installation>)
    );

    await installTransformForDataset(
      ({
        name: 'endpoint',
        version: '0.16.0-dev.0',
        datasets: [
          {
            type: 'metrics',
            name: 'endpoint.metadata',
            title: 'Endpoint Metadata',
            release: 'experimental',
            package: 'endpoint',
            ingest_pipeline: 'default',
            elasticsearch: {
              'index_template.mappings': {
                dynamic: false,
              },
            },
            path: 'metadata',
          },
          {
            type: 'metrics',
            name: 'endpoint.metadata_current',
            title: 'Endpoint Metadata Current',
            release: 'experimental',
            package: 'endpoint',
            ingest_pipeline: 'default',
            elasticsearch: {
              'index_template.mappings': {
                dynamic: false,
              },
            },
            path: 'metadata_current',
          },
        ],
      } as unknown) as RegistryPackage,
      [
        'endpoint-0.16.0-dev.0/dataset/policy/elasticsearch/ingest_pipeline/default.json',
        'endpoint-0.16.0-dev.0/dataset/metadata/elasticsearch/transform/default.json',
        'endpoint-0.16.0-dev.0/dataset/metadata_current/elasticsearch/transform/default.json',
      ],
      legacyScopedClusterClient.callAsCurrentUser,
      savedObjectsClient
    );

    expect(legacyScopedClusterClient.callAsCurrentUser.mock.calls).toEqual([
      [
        'transport.request',
        {
          method: 'POST',
          path: '_transform/metrics-endpoint.metadata_current-default-0.15.0-dev.0/_stop',
          query: 'force=true',
          ignore: [404],
        },
      ],
      [
        'transport.request',
        {
          method: 'DELETE',
          query: 'force=true',
          path: '_transform/metrics-endpoint.metadata_current-default-0.15.0-dev.0',
          ignore: [404],
        },
      ],
      [
        'transport.request',
        {
          method: 'PUT',
          path: '_transform/metrics-endpoint.metadata-default-0.16.0-dev.0',
          query: 'defer_validation=true',
          body: '{"content": "data"}',
        },
      ],
      [
        'transport.request',
        {
          method: 'PUT',
          path: '_transform/metrics-endpoint.metadata_current-default-0.16.0-dev.0',
          query: 'defer_validation=true',
          body: '{"content": "data"}',
        },
      ],
      [
        'transport.request',
        {
          method: 'POST',
          path: '_transform/metrics-endpoint.metadata-default-0.16.0-dev.0/_start',
        },
      ],
      [
        'transport.request',
        {
          method: 'POST',
          path: '_transform/metrics-endpoint.metadata_current-default-0.16.0-dev.0/_start',
        },
      ],
    ]);

    expect(savedObjectsClient.update.mock.calls).toEqual([
      [
        'epm-packages',
        'endpoint',
        {
          installed_es: [
            {
              id: 'metrics-endpoint.policy-0.16.0-dev.0',
              type: 'ingest_pipeline',
            },
            {
              id: 'metrics-endpoint.metadata_current-default-0.15.0-dev.0',
              type: 'transform',
            },
            {
              id: 'metrics-endpoint.metadata-default-0.16.0-dev.0',
              type: 'transform',
            },
            {
              id: 'metrics-endpoint.metadata_current-default-0.16.0-dev.0',
              type: 'transform',
            },
          ],
        },
      ],
      [
        'epm-packages',
        'endpoint',
        {
          installed_es: [
            {
              id: 'metrics-endpoint.policy-0.16.0-dev.0',
              type: 'ingest_pipeline',
            },
            {
              id: 'metrics-endpoint.metadata_current-default-0.16.0-dev.0',
              type: 'transform',
            },
            {
              id: 'metrics-endpoint.metadata-default-0.16.0-dev.0',
              type: 'transform',
            },
          ],
        },
      ],
    ]);
  });

  test('can install new version and when no older version', async () => {
    const previousInstallation: Installation = ({
      installed_es: [],
    } as unknown) as Installation;

    const currentInstallation: Installation = ({
      installed_es: [
        {
          id: 'metrics-endpoint.metadata-current-default-0.16.0-dev.0',
          type: ElasticsearchAssetType.transform,
        },
      ],
    } as unknown) as Installation;
    (getAsset as jest.MockedFunction<typeof getAsset>).mockReturnValueOnce(
      Buffer.from('{"content": "data"}', 'utf8')
    );
    (getInstallation as jest.MockedFunction<typeof getInstallation>)
      .mockReturnValueOnce(Promise.resolve(previousInstallation))
      .mockReturnValueOnce(Promise.resolve(currentInstallation));

    (getInstallationObject as jest.MockedFunction<
      typeof getInstallationObject
    >).mockReturnValueOnce(
      Promise.resolve(({ attributes: { installed_es: [] } } as unknown) as SavedObject<
        Installation
      >)
    );
    legacyScopedClusterClient.callAsCurrentUser = jest.fn();
    await installTransformForDataset(
      ({
        name: 'endpoint',
        version: '0.16.0-dev.0',
        datasets: [
          {
            type: 'metrics',
            name: 'endpoint.metadata_current',
            title: 'Endpoint Metadata',
            release: 'experimental',
            package: 'endpoint',
            ingest_pipeline: 'default',
            elasticsearch: {
              'index_template.mappings': {
                dynamic: false,
              },
            },
            path: 'metadata_current',
          },
        ],
      } as unknown) as RegistryPackage,
      ['endpoint-0.16.0-dev.0/dataset/metadata_current/elasticsearch/transform/default.json'],
      legacyScopedClusterClient.callAsCurrentUser,
      savedObjectsClient
    );

    expect(legacyScopedClusterClient.callAsCurrentUser.mock.calls).toEqual([
      [
        'transport.request',
        {
          method: 'PUT',
          path: '_transform/metrics-endpoint.metadata_current-default-0.16.0-dev.0',
          query: 'defer_validation=true',
          body: '{"content": "data"}',
        },
      ],
      [
        'transport.request',
        {
          method: 'POST',
          path: '_transform/metrics-endpoint.metadata_current-default-0.16.0-dev.0/_start',
        },
      ],
    ]);
    expect(savedObjectsClient.update.mock.calls).toEqual([
      [
        'epm-packages',
        'endpoint',
        {
          installed_es: [
            { id: 'metrics-endpoint.metadata_current-default-0.16.0-dev.0', type: 'transform' },
          ],
        },
      ],
    ]);
  });

  test('can removes older version when no new install in package', async () => {
    const previousInstallation: Installation = ({
      installed_es: [
        {
          id: 'metrics-endpoint.metadata-current-default-0.15.0-dev.0',
          type: ElasticsearchAssetType.transform,
        },
      ],
    } as unknown) as Installation;

    const currentInstallation: Installation = ({
      installed_es: [],
    } as unknown) as Installation;

    (getInstallation as jest.MockedFunction<typeof getInstallation>)
      .mockReturnValueOnce(Promise.resolve(previousInstallation))
      .mockReturnValueOnce(Promise.resolve(currentInstallation));

    (getInstallationObject as jest.MockedFunction<
      typeof getInstallationObject
    >).mockReturnValueOnce(
      Promise.resolve(({
        attributes: { installed_es: currentInstallation.installed_es },
      } as unknown) as SavedObject<Installation>)
    );

    await installTransformForDataset(
      ({
        name: 'endpoint',
        version: '0.16.0-dev.0',
        datasets: [
          {
            type: 'metrics',
            name: 'endpoint.metadata',
            title: 'Endpoint Metadata',
            release: 'experimental',
            package: 'endpoint',
            ingest_pipeline: 'default',
            elasticsearch: {
              'index_template.mappings': {
                dynamic: false,
              },
            },
            path: 'metadata',
          },
          {
            type: 'metrics',
            name: 'endpoint.metadata_current',
            title: 'Endpoint Metadata Current',
            release: 'experimental',
            package: 'endpoint',
            ingest_pipeline: 'default',
            elasticsearch: {
              'index_template.mappings': {
                dynamic: false,
              },
            },
            path: 'metadata_current',
          },
        ],
      } as unknown) as RegistryPackage,
      [],
      legacyScopedClusterClient.callAsCurrentUser,
      savedObjectsClient
    );

    expect(legacyScopedClusterClient.callAsCurrentUser.mock.calls).toEqual([
      [
        'transport.request',
        {
          ignore: [404],
          method: 'POST',
          path: '_transform/metrics-endpoint.metadata-current-default-0.15.0-dev.0/_stop',
          query: 'force=true',
        },
      ],
      [
        'transport.request',
        {
          ignore: [404],
          method: 'DELETE',
          path: '_transform/metrics-endpoint.metadata-current-default-0.15.0-dev.0',
          query: 'force=true',
        },
      ],
    ]);
    expect(savedObjectsClient.update.mock.calls).toEqual([
      [
        'epm-packages',
        'endpoint',
        {
          installed_es: [],
        },
      ],
    ]);
  });
});
