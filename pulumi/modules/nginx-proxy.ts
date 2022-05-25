import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface NginxProxyOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
}

export class NginxProxy extends pulumi.ComponentResource {
  readonly name: string;
  readonly options: NginxProxyOptions;
  readonly namespace: k8s.core.v1.Namespace;
  readonly serverConfig: k8s.core.v1.ConfigMap;
  readonly helmRelease: k8s.helm.v3.Release;

  /**
     * @param {string} name Name of nginx proxy server.
     * @param {NginxProxyOptions} nginxProxyOptions Additional options to apply.
     * @param {pulumi.ResourceOptions | undefined} opts Additional pulumi settings.
     */
  constructor(name: string, nginxProxyOptions: NginxProxyOptions, opts?: pulumi.ResourceOptions) {
    super("modules:NginxProxy", name, {}, opts);

    this.name = name;
    this.options = nginxProxyOptions;
    this.namespace = this.createNamespace();
    this.serverConfig = this.createServerConfig();
    this.helmRelease = this.createHelmRelease();
  }

  /**
     * Create separate namespace for Nginx proxy helm release.
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

  /**
     * Create k8s config map contains custom server block
     * to be added to NGINX configuration.
     * @return {k8s.core.v1.ConfigMap} k8s config map with nginx server block configuration.
     */
  private createServerConfig(): k8s.core.v1.ConfigMap {
    return new k8s.core.v1.ConfigMap(
        "nginx-server-configuration",
        {
          metadata: {
            name: "nginx-server-configuration",
            namespace: this.namespace.metadata.name,
          },
          data: {
            "server-block.conf": pulumi.all([
              this.options.postgresHost,
              this.options.postgresPort,
            ]).apply(
                ([host, port]) => [
                  "server {",
                  "  listen 8000 default_server;",
                  "  listen [::]:8000 default_server;",
                  "  location /health {",
                  `      return 200;`,
                  "  }",
                  "}",
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
     * Create helm release of Nginx proxy.
     * @return {k8s.helm.v3.Release} helm release.
     */
  private createHelmRelease(): k8s.helm.v3.Release {
    return new k8s.helm.v3.Release(
        this.name,
        {
          version: "11.1.5",
          chart: "nginx",
          name: "nginx-proxy",
          namespace: this.namespace.metadata.name,
          repositoryOpts: {
            repo: "https://charts.bitnami.com/bitnami",
          },
          atomic: true,
          cleanupOnFail: true,
          values: {
            image: {
              registry: "docker.io",
              repository: "bitnami/nginx",
              tag: "1.21.6-debian-10-r105",
            },
            replicaCount: 1,
            updateStrategy: {
              type: "RollingUpdate",
            },
            containerPorts: {
              http: 8000,
            },
            resources: {
              requests: {},
              limits: {},
            },
            service: {
              type: "LoadBalancer",
              ports: {
                http: 8000,
                https: 8443,
              },
            },
            // metrics: {
            //   enabled: true,
            //   image: {
            //     registry: "docker.io",
            //     repository: "bitnami/nginx-exporter",
            //     tag: "0.10.0-debian-10-r137",
            //   },
            //   service: {
            //     port: 9113,
            //   },
            //   resources: {
            //     requests: {},
            //     limits: {},
            //   },
            // },
            existingServerBlockConfigmap: this.serverConfig.metadata.name,
          },
        },
        {
          parent: this,
        },
    );
  }
}
