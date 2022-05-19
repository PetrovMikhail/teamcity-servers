import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TeamCityOptions {
  postgresHost: pulumi.Input<string>;
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
            "connectionProperties.user": "user1",
            "connectionProperties.password": "password",
            "connectionUrl": pulumi.interpolate `jdbc:postgresql://${teamCityOptions.postgresHost}:5432/database1`,
          },
          // data: {
          //   "connection-properties": JSON.stringify(
          //   {
          //   "connectionProperties.user": "user1",
          //   "connectionProperties.password": "password",
          //   "connectionUrl": pulumi.interpolate `jdbc:postgresql://${teamCityOptions.postgresHost}:5432/database1`,
          //   })
          // },
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
            replicas: 0,
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
              // {
              //   name: "db-config",
              //   mountPath: "/data/teamcity_server/datadir/config/database.properties",
              //   readOnly: true,
              // },
            ],
            volumes: [
              // {
              //   name: "db-config",
              //   secret: {
              //     secretName: this.databaseSecret.metadata.name,
              //     optional: false,
              //   },
              // },
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
