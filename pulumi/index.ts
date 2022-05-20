import * as pulumi from "@pulumi/pulumi";
import {PostgreSql} from "./modules/postgresql";
import {TeamCityDatabase} from "./modules/teamcity-database";
import {TeamCity} from "./modules/teamcity";


const postgreSql = new PostgreSql(
    "postgreSql",
    {
      label: "123",
    },
);

for (let i = 0; i < 1; i++) {
  const teamCityDatabase = new TeamCityDatabase(
      `teamcity-${i}`,
      {
        postgresHost: pulumi.interpolate `${postgreSql.helmRelease.name}.${postgreSql.namespace.metadata.name}.svc.cluster.local`,
        postgresPort: 5432,
        postgresAdminPassword: postgreSql.adminPassword,
      },
      {
        dependsOn: [postgreSql],
      },
  );

  const teamCity = new TeamCity(
      `teamcity-${i}`,
      {
        postgresHost: pulumi.interpolate `${postgreSql.helmRelease.name}.${postgreSql.namespace.metadata.name}.svc.cluster.local`,
        postgresPort: 5432,
        databasePassword: teamCityDatabase.rolePassword,
      },
      {
        dependsOn: [postgreSql, teamCityDatabase],
      },
  );
}
