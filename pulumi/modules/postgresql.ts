import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

export interface PostgreSqlOptions {
    serviceType: string,
    serivePort: number,
}

export class PostgreSql extends pulumi.ComponentResource {
  readonly options: PostgreSqlOptions;
  readonly namespace: k8s.core.v1.Namespace;
  readonly adminPassword: pulumi.Output<string>;
  readonly passwordSecret: k8s.core.v1.Secret;
  readonly helmRelease: k8s.helm.v3.Release;

  /**
     * @param {string} name Name of postgresql object.
     * @param {PostgreSqlOptions} postgreSqlOptions Additional options to apply.
     * @param {pulumi.ResourceOptions | undefined} opts Additional pulumi settings.
     */
  constructor(name: string, postgreSqlOptions: PostgreSqlOptions, opts?: pulumi.ResourceOptions) {
    super("modules:PostgeSql", name, {}, opts);

    this.options = postgreSqlOptions;
    this.namespace = this.createNamespace();
    this.adminPassword = this.generateAdminPassword();
    this.passwordSecret = this.createPasswordSecret();
    this.helmRelease = this.createHelmRelease();
  }

  /**
     * Create separate namespace for Postgresql helm release.
     * @return {k8s.core.v1.Namespace} k8s namespace.
     */
  private createNamespace(): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
        "postgresql",
        {
          metadata: {
            name: "postgresql",
          },
        },
        {
          parent: this,
        },
    );
  }

  /**
     * Generate strong password for database admin user.
     * @return {pulumi.Output<string>} admin password.
     */
  private generateAdminPassword(): pulumi.Output<string> {
    return new random.RandomPassword(
        "master-password",
        {
          length: 20,
          special: false,
        },
        {
          ignoreChanges: [
            "length",
            "special",
            "overrideSpecial",
          ],
          parent: this,
        },
    ).result;
  }

  /**
     * Save database admin password in k8s secret to have
     * a possibility to create postgresql provider using it.
     * @return {k8s.core.v1.Secret} k8s secret contains admin password.
     */
  private createPasswordSecret(): k8s.core.v1.Secret {
    return new k8s.core.v1.Secret(
        "admin-secret",
        {
          metadata: {
            name: "admin-secret",
            namespace: this.namespace.metadata.name,
          },
          stringData: {
            "postgres-password": this.adminPassword,
          },
        },
        {
          parent: this,
        },
    );
  }

  /**
     * Create helm release of Postgresql.
     * @return {k8s.helm.v3.Release} helm release.
     */
  private createHelmRelease(): k8s.helm.v3.Release {
    return new k8s.helm.v3.Release(
        "postgresql",
        {
          version: "11.2.4",
          chart: "postgresql",
          name: "postgresql",
          namespace: this.namespace.metadata.name,
          repositoryOpts: {
            repo: "https://charts.bitnami.com/bitnami",
          },
          atomic: true,
          cleanupOnFail: true,
          values: {
            image: {
              registry: "docker.io",
              repository: "bitnami/postgresql",
              tag: "14.2.0-debian-10-r58",
            },
            auth: {
              enablePostgresUser: true,
              existingSecret: this.passwordSecret.metadata.name,
            },
            architecture: "standalone",
            primary: {
              resources: {
                requests: {
                  memory: "256Mi",
                  cpu: "250m",
                },
                limits: {},
              },
              service: {
                type: this.options.serviceType,
                ports: {
                  postgresql: this.options.serivePort,
                },
                nodePorts: {
                  postgresql: "",
                },
              },
              persistence: {
                enabled: true,
                accessModes: ["ReadWriteOnce"],
                size: "8Gi",
              },
            },
          },
        },
        {
          parent: this,
        },
    );
  }
}
