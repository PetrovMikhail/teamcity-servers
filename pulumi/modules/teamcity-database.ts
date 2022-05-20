import * as pulumi from "@pulumi/pulumi";
import * as postgresql from "@pulumi/postgresql";
import * as random from "@pulumi/random";

export interface TeamCityDatabaseOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
  postgresAdminPassword: pulumi.Input<string>,
}

export class TeamCityDatabase extends pulumi.ComponentResource {
  readonly options: TeamCityDatabaseOptions;
  readonly provider: postgresql.Provider;
  readonly rolePassword: pulumi.Output<string>;
  readonly role: postgresql.Role;
  readonly database: postgresql.Database;
  readonly grant: postgresql.Grant;

  constructor(serverName: string, teamCityDatabaseOptions: TeamCityDatabaseOptions, opts?: pulumi.ResourceOptions) {
    super("modules:TeamCityDatabase", serverName, {}, opts);
    this.options = teamCityDatabaseOptions;

    this.provider = new postgresql.Provider(serverName,
        {
          // host: pulumi.interpolate `${this.options.postgresHost}`,
          host: "127.0.0.1",
          port: this.options.postgresPort,
          databaseUsername: "postgres",
          username: "postgres",
          password: pulumi.interpolate `${this.options.postgresAdminPassword}`,
          superuser: false,
          sslmode: "disable",
        },
        {
          parent: this,
        },
    );

    this.rolePassword = new random.RandomPassword(
        serverName,
        {
          length: 10,
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

    this.role = new postgresql.Role(
        serverName,
        {
          name: serverName,
          password: this.rolePassword,
          login: true,
          createDatabase: true,
        },
        {
          provider: this.provider,
          parent: this,
        },
    );

    this.database = new postgresql.Database(
        serverName,
        {
          name: serverName,
        },
        {
          provider: this.provider,
          parent: this,
        },
    );


    this.grant = new postgresql.Grant(
        serverName,
        {
          database: this.database.name,
          objectType: "database",
          privileges: ["ALL"], // ["SELECT", "INSERT", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "CREATE", "CONNECT", "TEMPORARY", "EXECUTE", "USAGE"],
          role: this.role.name,
        },
        {
          provider: this.provider,
          parent: this,
        },
    );
  }
}
