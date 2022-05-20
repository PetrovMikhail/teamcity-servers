import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TeamCityOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
  databasePassword: pulumi.Input<string>,
}

export class TeamCity extends pulumi.ComponentResource {
  readonly namespace: k8s.core.v1.Namespace;
  readonly databaseSecret: k8s.core.v1.Secret;
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

    this.databaseSecret = new k8s.core.v1.Secret(
        `${serverName}-db`,
        {
          metadata: {
            name: `${serverName}-db`,
            namespace: this.namespace.metadata.name,
          },
          stringData: {
            "connection-properties": pulumi.all([
              teamCityOptions.postgresHost,
              teamCityOptions.postgresPort,
              serverName,
              teamCityOptions.databasePassword,
            ]).apply(
                ([host, port, database, password]) => [
                  `connectionProperties.user=${serverName}`,
                  `connectionProperties.password=${password}`,
                  `connectionUrl=jdbc:postgresql://${host}:${port}/${database}`,
                ].join("\n"),
            ),
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
          values: {
            image: {
              repository: "jetbrains/teamcity-server",
              tag: "2022.04",
            },
            replicas: 1,
            service: {
              type: "ClusterIP",
              port: 8111,
            },
            resources: {
              limits: {
                memory: "968Mi",
                cpu: "800m",
              },
              requests: {
                memory: "968Mi",
                cpu: "600m",
              },
            },
            volumeMounts: [
              {
                name: "server-data",
                mountPath: "/data/teamcity_server/datadir",
                readOnly: false,
              },
              {
                name: "db-config",
                mountPath: "/data/teamcity_server/datadir/config",
                readOnly: false,
              },
            ],
            volumes: [
              {
                name: "db-config",
                secret: {
                  secretName: this.databaseSecret.metadata.name,
                  items: [{
                    key: "connection-properties",
                    path: "database.properties",
                  }],
                  optional: false,
                },
              },
              {
                name: "server-data",
                persistentVolumeClaim: {
                  claimName: `${serverName}-server-data`,
                },
              },
            ],
          },
        },
        {
          parent: this,
        },
    );
  }
}
