import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import {TeamCity} from "./modules/teamcity";
import {PostgreSql} from "./modules/postgresql";

const postgreSql = new PostgreSql(
    "postgreSql",
    {
      label: "123",
    },
);

// const teamCity = new TeamCity(
//     "teamcity-1",
//     {
//       label: "123",
//     },
//     {
//       dependsOn: [postgreSql],
//     },
// );
