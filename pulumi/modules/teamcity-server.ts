import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface TeamCityServerOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
  databasePassword: pulumi.Input<string>,
  servicePort: number,
  proxyConfigMap: k8s.core.v1.ConfigMap;
}

export class TeamCityServer extends pulumi.ComponentResource {
  readonly name: string;
  readonly options: TeamCityServerOptions;
  readonly namespace: k8s.core.v1.Namespace;
  readonly databaseSecret: k8s.core.v1.Secret;
  readonly helmRelease: k8s.helm.v3.Release;

  /**
     * @param {string} serverName Name of Teamcity server.
     * @param {TeamCityServerOptions} teamCityServerOptions Additional options to apply.
     * @param {pulumi.ResourceOptions | undefined} opts Additional pulumi settings.
     */
  constructor(serverName: string, teamCityServerOptions: TeamCityServerOptions, opts?: pulumi.ResourceOptions) {
    super("modules:TeamCityServer", serverName, {}, opts);

    this.name = serverName;
    this.options = teamCityServerOptions;
    this.namespace = this.createNamespace();
    this.databaseSecret = this.createDatabaseSecret();
    this.helmRelease = this.createHelmRelease();
  }

  /**
     * Create separate namespace for Teamcity server helm release.
     * @return {k8s.core.v1.Namespace} k8s namespace.
     */
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

  private updateProxyConfigmap(): k8s.core.v1.Namespace {
    this.options.proxyConfigMap.metadata.= {
      "server-block.conf": "asd"
    }

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

  /**
     * Create k8s secret contains properties for teamcity server
     * connection to owned database in postgresql. Properties
     * have to match a strict format.
     * @return {k8s.core.v1.Secret} k8s secret with db connection properties.
     */
  private createDatabaseSecret(): k8s.core.v1.Secret {
    return new k8s.core.v1.Secret(
        `${this.name}-db-properties`,
        {
          metadata: {
            name: "db-properties",
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

  /**
     * Create helm release of Teamcity server.
     * @return {k8s.helm.v3.Release} helm release.
     */
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
              repository: "jetbrains/teamcity-server",
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
            env: [
              {
                name: "TEAMCITY_SERVER_MEM_OPTS",
                value: "-Xmx2g -XX:ReservedCodeCacheSize=350m",
              },
            ],
            service: {
              type: "LoadBalancer",
              port: this.options.servicePort,
            },
            initContainers: [
              {
                name: "download-drivers",
                image: "curlimages/curl:7.83.0",
                command: ["/bin/sh"],
                args: ["-c", "curl -s --show-error https://jdbc.postgresql.org/download/postgresql-42.2.20.jar \
                  -o /var/drivers/postgresql-42.2.20.jar"],
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
                memory: "4096Mi",
                cpu: "2000m",
              },
              requests: {
                memory: "2048Mi",
                cpu: "2000m",
              },
            },
            volumes: [
              {
                name: "db-config",
                secret: {
                  secretName: this.databaseSecret.metadata.name,
                  optional: false,
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
                mountPath: "/data/teamcity_server/datadir/config/database.properties",
                subPath: "database.properties",
                readOnly: true,
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
