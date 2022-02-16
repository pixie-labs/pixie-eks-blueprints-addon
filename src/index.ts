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

import { ClusterAddOn, ClusterInfo } from '@aws-quickstart/ssp-amazon-eks';
import { Construct } from '@aws-cdk/core';

export type DataAccessType = 'Full' | 'Restricted' | 'PIIRestricted';

export interface PixieAddOnProps {
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

const defaultProps: PixieAddOnProps = {
    repository: "https://pixie-operator-charts.storage.googleapis.com",
    release: "pixie",
    chart: "pixie-operator-chart",
    version: "0.0.18",
    namespace: "pl",
    cloudAddr: "withpixie.ai:443",
    useEtcdOperator: false,
    pemMemoryLimit: "2Gi",
    dataAccess: "Full",
};

export class PixieAddOn implements ClusterAddOn {
    readonly options: PixieAddOnProps;

    constructor(props?: PixieAddOnProps) {
        this.options = {...defaultProps, ...props};
    }

    deploy(clusterInfo: ClusterInfo): Promise<Construct> {
    	const props = this.options;

	const pixieHelmChart = clusterInfo.cluster.addHelmChart("pixie", {
            chart: props.chart,
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
	    }
        });
        return Promise.resolve(pixieHelmChart);
    }
}
