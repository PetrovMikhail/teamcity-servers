import * as pulumi from "@pulumi/pulumi";
import {PostgreSql} from "./modules/postgresql";
import {TeamCity} from "./modules/teamcity";

const postgreSql = new PostgreSql(
    "postgreSql",
    {
      label: "123",
    },
);

const teamCity =
  new TeamCity(
      "teamcity-0",
      {
        postgresHost: pulumi.interpolate `${postgreSql.helmRelease.name}.${postgreSql.namespace.metadata.name}.svc.cluster.local`,
        postgresPort: 5432,
        postgresAdminPassword: postgreSql.adminPassword,
      },
      {
        dependsOn: [postgreSql],
      },
  );
