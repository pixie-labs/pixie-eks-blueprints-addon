# Pixie AddOn for EKS Blueprints 

This repository contains the source code for the Pixie AddOn for EKS Blueprints. `ssp-amazon-eks` is a [CDK](https://aws.amazon.com/cdk/) construct that makes it easy for customers to build and deploy a Shared Services Platform (SSP) on top of [Amazon EKS](https://aws.amazon.com/eks/).

Pixie is an open source observability tool for Kubernetes applications. Use Pixie to view the high-level state of your cluster (service maps, cluster resources, application traffic) and also drill-down into more detailed views (pod state, flame graphs, individual full-body application requests). Read more about Pixie [here](https://pixielabs.ai/).

## Installation

Using [npm](https://npmjs.org):

```bash
$ npm install @pixie-labs/pixie-blueprints-addon
```

## Usage

#### Using deploy key:

```
import { App } from '@aws-cdk/core';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';
import { PixieAddOn } from '@pixie-labs/pixie-blueprints-addon';

const app = new App();

ssp.EksBlueprint.builder()
    .addOns(new PixieAddOn({
        deployKey: "pixie-deploy-key", // Create and copy from Pixie Admin UI
    }))
    .region(process.env.AWS_REGION)
    .account(process.env.AWS_ACCOUNT)
    .build(app, 'my-test-cluster');
```

#### Using deploy key stored in Secrets Manager:

```
import { App } from '@aws-cdk/core';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';
import { PixieAddOn } from '@pixie-labs/pixie-blueprints-addon';

const app = new App();

ssp.EksBlueprint.builder()
    .addOns(new ssp.addons.SecretsStoreAddOn)
    .addOns(new PixieAddOn({
        deployKeySecretName: "pixie-deploy-key-secret", // Name of secret in Secrets Manager.
    }))
    .region(process.env.AWS_REGION)
    .account(process.env.AWS_ACCOUNT)
    .build(app, 'my-test-cluster');
```

## `PixieAddOn` Options (props)

#### `deployKey: string` (optional)

Pixie deployment key (plain text).  Log into the Admin UI in Pixie to generate a deployment key. This attaches your Pixie deployment to your org.

#### `deployKeySecretName: string` (optional)

The name of the Pixie deployment key secret in Secrets Manager. The value of the key in Secrets Manager should be the deploy key in plaintext. Do not nest it inside a JSON object.

#### `namespace?: string` (optional)

Namespace to deploy Pixie to. Default: `pl`

#### `cloudAddr?: string` (optional)

The address of Pixie Cloud. This should only be modified if you have deployed your own self-hosted Pixie Cloud. By default, it will be set to [Community Cloud for Pixie](https://work.withpixie.dev).

#### `devCloudNamespace?: string` (optional)

If running in a self-hosted cloud with no DNS configured, the namespace in which the self-hosted cloud is running. 

#### `clusterName?: string` (optional)

The name of cluster. If none is specified, a random name will be generated.

#### `useEtcdOperator?: boolean` (optional)

Whether the metadata store should use etcd to store metadata, or use a persistent volume store. If not specified, the operator will deploy based on the cluster's storageClass configuration.

#### `pemMemoryLimit?: string` (optional)

The memory limit applied to the PEMs (data collectors). Set to 2Gi by default.

#### `dataAccess?: "Full"|"Restricted"|"PIIRestricted"` (optional)

DataAccess defines the level of data that may be accesssed when executing a script on the cluster. If none specified, assumes full data access.

#### `patches?: [key: string]: string` (optional)

Custom K8s patches which should be applied to the Pixie YAMLs. The key should be the name of the K8s resource, and the value is the patch that should be applied.

#### `version?: string` (optional)

Helm chart version.

#### `repository?: string`, `release?: string`, `chart?: string` (optional)

Additional options for customers who may need to supply their own private Helm repository.

## License
pixie-blueprints-addon is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

