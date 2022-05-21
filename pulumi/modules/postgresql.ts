import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

export interface PostgreSqlOptions {
    label: string,
}

export class PostgreSql extends pulumi.ComponentResource {
  readonly namespace: k8s.core.v1.Namespace;
  readonly adminPassword: pulumi.Output<string>;
  readonly passwordSecret: k8s.core.v1.Secret;
  readonly helmRelease: k8s.helm.v3.Release;

  constructor(name: string, postgreSqlOptions: PostgreSqlOptions, opts?: pulumi.ResourceOptions) {
    super("modules:PostgeSql", name, {}, opts);

    this.namespace = this.createNamespace();
    this.adminPassword = this.generateAdminPassword();
    this.passwordSecret = this.createPasswordSecret();
    this.helmRelease = this.createHelmRelease();
  }

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

  private generateAdminPassword(): pulumi.Output<string> {
    return new random.RandomPassword(
        "masterPassword",
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
            "password": "password",
          },
        },
        {
          parent: this,
        },
    );
  }

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
              username: "user1",
              database: "database1",
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
                type: "LoadBalancer",
                ports: {
                  postgresql: 5432,
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
