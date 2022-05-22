import * as pulumi from "@pulumi/pulumi";
import * as postgresql from "@pulumi/postgresql";
import * as random from "@pulumi/random";

export interface TeamCityDatabaseOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
  postgresAdminPassword: pulumi.Input<string>,
}

export class TeamCityDatabase extends pulumi.ComponentResource {
  readonly name: string;
  readonly options: TeamCityDatabaseOptions;
  readonly provider: postgresql.Provider;
  readonly rolePassword: pulumi.Output<string>;
  readonly role: postgresql.Role;
  readonly database: postgresql.Database;
  readonly grant: postgresql.Grant;

  /**
     * @param {string} serverName Name of related Teamcity server.
     * @param {TeamCityDatabaseOptions} teamCityDatabaseOptions Additional options to apply.
     * @param {pulumi.ResourceOptions | undefined} opts Additional pulumi settings.
     */
  constructor(serverName: string, teamCityDatabaseOptions: TeamCityDatabaseOptions, opts?: pulumi.ResourceOptions) {
    super("modules:TeamCityDatabase", serverName, {}, opts);

    this.name = serverName;
    this.options = teamCityDatabaseOptions;
    this.provider = this.createProvider();
    this.rolePassword = this.generatePassword();
    this.role = this.createRole();
    this.database = this.createDatabase();
    this.grant = this.createGrant();
  }

  /**
     * Create postgresql provider to have a possibility
     * to create separate database for Teamcity server.
     * @return {postgresql.Provider} Postgresql provider.
     */
  private createProvider(): postgresql.Provider {
    return new postgresql.Provider(
        `${this.name}-db-provider`,
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
  }

  /**
     * Generate password for Teamcity server database role.
     * @return {pulumi.Output<string>} Database role password.
     */
  private generatePassword(): pulumi.Output<string> {
    return new random.RandomPassword(
        `${this.name}-role-password`,
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
  }

  /**
     * Create new database role for Teamcity server.
     * @return {postgresql.Role} Database role.
     */
  private createRole(): postgresql.Role {
    return new postgresql.Role(
        `${this.name}-db-role`,
        {
          name: `${this.name}`,
          password: this.rolePassword,
          login: true,
          createDatabase: true,
        },
        {
          provider: this.provider,
          parent: this,
        },
    );
  }

  /**
     * Create new database as external database
     * for Teamcity server
     * @return {postgresql.Database} Database.
     */
  private createDatabase(): postgresql.Database {
    return new postgresql.Database(
        `${this.name}-database`,
        {
          name: `${this.name}`,
        },
        {
          provider: this.provider,
          parent: this,
        },
    );
  }

  /**
     * Grant all needed rights for created database
     * to created database role
     * @return {postgresql.Grant} Database grant.
     */
  private createGrant(): postgresql.Grant {
    return new postgresql.Grant(
        `${this.name}-db-grant`,
        {
          database: this.database.name,
          objectType: "database",
          privileges: ["ALL"], // ["SELECT", "INSERT", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "CREATE", "CONNECT", "TEMPORARY", "EXECUTE", "USAGE"],
          role: this.role.name,
        },
        {
          provider: this.provider,
          parent: this,
          ignoreChanges: [
            "privileges",
          ],
        },
    );
  }
}
