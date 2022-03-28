/*
 * Copyright 2018- The Pixie Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ssp from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import { ServiceAccount } from 'aws-cdk-lib/aws-eks';

export type DataAccessType = 'Full' | 'Restricted' | 'PIIRestricted';

export interface PixieAddOnProps extends ssp.addons.HelmAddOnUserProps {
    /**
     * Helm chart repository.
     * Defaults to the official repo URL.
     */
    repository?: string;

    /**
     * Release name.
     * Defaults to 'pixie'.
     */
    release?: string;

    /**
     * Chart name.
     * Defaults to 'pixie-operator-chart'.
     */
    chart?: string;

    /**
     * Helm chart version
     */
    version?: string;

    /**
     * Namespace for the add-on.
     */
    namespace?: string;

    /**
     * Address for the Pixie Cloud instance to deploy to. Points to
     * Community Cloud for Pixie by default.
     */
    cloudAddr?: string;

    /**
     * Deploy key from Pixie Cloud. Used to link the Pixie deployment
     * to an org.
     */
    deployKey?: string;

    /**
     * If the deployKey is a secret in AWS Secrets Manager, the name of the
     * secret in Secrets Manager.
     */
    deployKeySecretName?: string;

    /**
     * Kubernetes cluster name.
     */
    clusterName?: string;

    /**
     * If running in a self-hosted cloud with no DNS configured, the namespace
     * in which the self-hosted cloud is running.
     */
    devCloudNamespace?: string;

    /**
     * Whether the metadata store should use etcd to store metadata, or use a
     * persistent volume store.
     */
    useEtcdOperator?: boolean;

    /**
     * Custom K8s patches which should be applied to the Pixie YAMLs. The key should be
     * the name of the K8s resource, and the value is the patch that should be applied.
     */
    patches?: {
        [key: string]: string;
    }

    /**
     * The memory limit applied to the PEMs (data collectors). Set to 2Gi by default.
     */
    pemMemoryLimit?: string;

    /**
     * DataAccess defines the level of data that may be accesssed when executing a script
     * on the cluster. If none specified, assumes full data access.
     */
    dataAccess?: DataAccessType;

}

/*
 * Creates a long-running pod which mounts the deploy key from Secrets Manager. For the time
 * being, this needs to be continually running for as long as we want the K8s secret
 * resource to exist.
 */
const createSecretPodManifest = (
  image: string,
  sa: ServiceAccount,
  secretProviderClassName: string,
) => {
  const name = 'pixie-secret-pod';
  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace: sa.serviceAccountNamespace,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { name } },
      template: {
        metadata: { labels: { name } },
        spec: {
          serviceAccountName: sa.serviceAccountName,
          containers: [
            {
              name,
              image,
              command: ['sh', '-c', 'while :; do sleep 2073600; done'],
              volumeMounts: [{
                name: 'secrets-store',
                mountPath: '/mnt/secrets-store',
                readOnly: true,
              }],
            },
          ],
          volumes: [{
            name: 'secrets-store',
            csi: {
              driver: 'secrets-store.csi.k8s.io',
              readOnly: true,
              volumeAttributes: {
                secretProviderClass: secretProviderClassName,
              },
            },
          }],
        },
      },
    },
  };
  return deployment;
};

const defaultProps: ssp.addons.HelmAddOnProps & PixieAddOnProps = {
  name: 'pixie-eks-blueprint-addon',
  repository: 'https://pixie-operator-charts.storage.googleapis.com',
  release: 'pixie',
  chart: 'pixie-operator-chart',
  version: '0.0.21',
  namespace: 'pl',
  cloudAddr: 'withpixie.ai:443',
  useEtcdOperator: false,
  pemMemoryLimit: '2Gi',
  dataAccess: 'Full',
  deployKey: '',
};

export class PixieAddOn extends ssp.addons.HelmAddOn {
  readonly options: PixieAddOnProps;

  /*
   * Sets up how the Secrets Manager secret should be deployed as K8s secret. Expects the
   * Secrets Manager secret naame to be passed in as "deployKeySecretName", and the value
   * of the secret should be the deployKey (not wrapped in any JSON structure).
   */
  setupSecret(clusterInfo: ssp.ClusterInfo, serviceAccount: ServiceAccount):
    ssp.SecretProviderClass {
    const csiSecret: ssp.addons.CsiSecretProps = {
      secretProvider: new ssp.LookupSecretsManagerSecretByName(this.options.deployKeySecretName!),
      kubernetesSecret: {
        secretName: 'pl-deploy-secrets',
        data: [
          {
            key: 'deploy-key',
          },
        ],
      },
    };

    return new ssp.addons.SecretProviderClass(clusterInfo, serviceAccount, 'pixie-deploy-key-secret-class', csiSecret);
  }

  constructor(props?: PixieAddOnProps) {
    super({ ...defaultProps, ...props });
    this.options = { ...defaultProps, ...props };
  }

  async deploy(clusterInfo: ssp.ClusterInfo): Promise<Construct> {
    const props = this.options;
    let secretPod : Construct | undefined;

    // Create namespace.
    const ns = ssp.utils.createNamespace(props.namespace!, clusterInfo.cluster, true);

    // If the secret is stored in Secrets Manager, create the secret provider class and pod
    // so that the secret is launched as a K8s secret.
    if (props.deployKeySecretName) {
      const sa = clusterInfo.cluster.addServiceAccount('pixie-addon-secret-sa', {
        name: 'pixie-addon-secret-sa',
        namespace: props.namespace,
      });
      sa.node.addDependency(ns);
      const secretProviderClass = this.setupSecret(clusterInfo, sa);
      secretPod = clusterInfo.cluster.addManifest(
        'pixie-secret-pod',
        createSecretPodManifest('busybox', sa, 'pixie-deploy-key-secret-class'),
      );
      secretProviderClass.addDependent(secretPod!);
    }

    const pixieHelmChart = clusterInfo.cluster.addHelmChart('pixie', {
      chart: props.chart!,
      release: props.release,
      repository: props.repository,
      namespace: props.namespace,
      version: props.version,
      values: {
        deployKey: props.deployKey,
        cloudAddr: props.cloudAddr,
        useEtcdOperator: props.useEtcdOperator,
        clusterName: props.clusterName,
        devCloudNamespace: props.devCloudNamespace,
        patches: props.patches,
      },
    });

    if (secretPod) {
      // Ensure that the namespace is created at the correct step.
      pixieHelmChart.node.addDependency(ns);
      pixieHelmChart.node.addDependency(secretPod);
      secretPod.node.addDependency(ns);
    }

    return Promise.resolve(pixieHelmChart);
  }
}
