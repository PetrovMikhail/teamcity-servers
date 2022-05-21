import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TeamCityServerOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
  databasePassword: pulumi.Input<string>,
}

export class TeamCityServer extends pulumi.ComponentResource {
  readonly name: string;
  readonly options: TeamCityServerOptions;
  readonly namespace: k8s.core.v1.Namespace;
  readonly databaseSecret: k8s.core.v1.Secret;
  readonly helmRelease: k8s.helm.v3.Release;

  constructor(serverName: string, teamCityServerOptions: TeamCityServerOptions, opts?: pulumi.ResourceOptions) {
    super("modules:TeamCityServer", serverName, {}, opts);

    this.name = serverName;
    this.options = teamCityServerOptions;
    this.namespace = this.createNamespace();
    this.databaseSecret = this.createDatabaseSecret();
    this.helmRelease = this.createHelmRelease();
  }

  private createNamespace(): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
        this.name,
        {
          metadata: {
            name: this.name,
          },
        },
        {
          parent: this,
        },
    );
  }

  private createDatabaseSecret(): k8s.core.v1.Secret {
    return new k8s.core.v1.Secret(
        `${this.name}-db`,
        {
          metadata: {
            name: `${this.name}-db`,
            namespace: this.namespace.metadata.name,
          },
          stringData: {
            "database.properties": pulumi.all([
              this.options.postgresHost,
              this.options.postgresPort,
              this.name,
              this.options.databasePassword,
            ]).apply(
                ([host, port, database, password]) => [
                  `connectionProperties.user=${this.name}`,
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
  }

  private createHelmRelease(): k8s.helm.v3.Release {
    return new k8s.helm.v3.Release(
        this.name,
        {
          version: "0.1.0",
          chart: "../charts/teamcity",
          name: this.name,
          namespace: this.namespace.metadata.name,
          atomic: true,
          cleanupOnFail: true,
          timeout: 600,
          values: {
            image: {
              // repository: "jetbrains/teamcity-server",
              repository: "docker.mshop.csolab.ru/teamcity-server",
              tag: "2022.04",
            },
            replicas: 1,
            rbac: {
              serviceAccount: {
                create: true,
              },
            },
            securityContext: {
              runAsUser: 0,
            },
            service: {
              type: "LoadBalancer",
              port: 8111,
            },
            initContainers: [
              {
                name: "download-drivers",
                image: "curlimages/curl:7.83.0",
                command: ["/bin/sh"],
                args: ["-c", "curl -sI https://jdbc.postgresql.org/download/postgresql-42.3.5.jar -o /var/drivers/postgresql-42.3.5.jar"],
                volumeMounts: [
                  {
                    name: "drivers",
                    mountPath: "/var/drivers",
                    readOnly: false,
                  },
                ],
              },
            ],
            resources: {
              limits: {
                memory: "2048Mi",
                cpu: "1000m",
              },
              requests: {
                memory: "2048Mi",
                cpu: "600m",
              },
            },
            volumes: [
              {
                name: "db-config",
                secret: {
                  secretName: this.databaseSecret.metadata.name,
                  optional: false,
                  defaultMode: 438,
                },
              },
              {
                name: "server-data",
                persistentVolumeClaim: {
                  claimName: `${this.name}-server-data`,
                },
              },
              {
                name: "drivers",
                emptyDir: {},
              },
              {
                name: "logs",
                persistentVolumeClaim: {
                  claimName: `${this.name}-logs`,
                },
              },
            ],
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
              {
                name: "drivers",
                mountPath: "/data/teamcity_server/datadir/lib/jdbc",
                readOnly: false,
              },
              {
                name: "logs",
                mountPath: "/opt/teamcity/logs",
                readOnly: false,
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
