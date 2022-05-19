import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TeamCityOptions {
    label: string,
}

export class TeamCity extends pulumi.ComponentResource {
  readonly namespace: k8s.core.v1.Namespace;
  readonly helmRelease: k8s.helm.v3.Release;

  constructor(serverName: string, teamCityOptions: TeamCityOptions, opts?: pulumi.ResourceOptions) {
    super("modules:TeamCity", serverName, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
        serverName,
        {
          metadata: {
            name: serverName,
          },
        },
        {
          parent: this,
        },
    );

    this.helmRelease = new k8s.helm.v3.Release(
        serverName,
        {
          version: "0.1.0",
          chart: "../charts/teamcity",
          name: serverName,
          namespace: this.namespace.metadata.name,
          atomic: true,
          cleanupOnFail: true,
        },
        {
          parent: this,
        },
    );
  }
}
