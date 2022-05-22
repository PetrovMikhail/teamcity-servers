# Teamcity servers

Pulumi project for creating and rolling out Teamcity servers into kubernetes cluster.
Project can be started locally but can be automated with CI in the future. 

Requirements:

* Make sure that Node.js is installed. [Install Node.js](https://nodejs.org/en/download/)
* Confirm that Pulumi is installed. [Install Pulumi](https://www.pulumi.com/docs/get-started/install/)
* Kubectl client is installed to connect to kubernetes cluster. [Install kubectl](https://kubernetes.io/ru/docs/tasks/tools/install-kubectl/)
* Docker daemon is installed to be used as virtualization driver for Minikube. [Install docker daemon](https://docs.docker.com/engine/install/)

## Minikube installation and configuring

To do fast and convinient deploy Teamcity servers Minikube installation is highly recommended. Also in the current implementation services exposing functionality is set to use Minikube by default and it should be additionally configured to work on cloud kubernetes clusters.

To start Minikube cluster please do the following steps:
1. Install Minikube in any convenient way, see the details: [Minikube installation](https://kubernetes.io/ru/docs/tasks/tools/install-minikube/)
1. Start Minikube cluster with docker driver for virtualization:
    ```shell
    minikube start --vm-driver=docker
    ```
1. Wait until Minikube creates cluster and check that cluster is succesfully installed:
    ```shell
    minikube status
    ```
1. Open the separate terminal window and type:
    ```shell
    minikube tunnel
    ```
`minikube tunnel` runs as a process, creating a network route on the host to the service CIDR of the cluster using the cluster’s IP address as a gateway. The tunnel command exposes the external IP directly to any program running on the host operating system.
It will allow access to services of type LoadBalancer in minikube cluster and make them availiable in the localhost.
Please don't close this terminal window with the tunnel during whole Teamcity servers deploy process!

## Deploy Teamcity with Pulumi

To start working with Pulumi you need to initiate the stack firstly. In the separate terminal window change directory to the `pulumi` folder and login to pulumi stack running this command:
```shell
pulumi login https://api.pulumi.com
```
By default Pulumi uses own API to store the stack state and first time you will be asked about the credentials. Login in any convinient way or set up your own Pulumi stack backend, see the detailes here https://www.pulumi.com/docs/intro/concepts/state/.

Then init a new pulumi stack:
```shell
pulumi stack init YOUR_STACK_NAME
pulumi stack select YOUR_STACK_NAME
```
After the succesful Pulumi login install all project dependencies with npm package manager, it might take some time:
```shell
npm install
```
After completing these steps all is ready to deploy Teamcity server. To preview all possible changes run the command:
```shell
pulumi preview
```
To deploy Teamcity servers in Minikube cluster run:
```shell
pulumi up -y
```

## Configuring bunch of Teamcity servers

To configure amount of Teamcity servers and their parameters edit `index.ts` file. By default Postgresql and one of the Teamcity servers are deployed in the kubernetes cluster. You can create as many Teamcity servers as you want (within the resources allocated for kubernetes cluster) using creation of new Teamcity class instances with unique server names (teamcity-0, teamcity-1 etc. for instance).

Also one of the requirement of Minikube implementation is to use different service ports for each Teamcity instance. This condition has to be met to have a possibility to connect to each Teamcity instanse via LoadBalancer service in parallel.

In addition you are able to implement loop to create a lot of instanses in one moment. Before this please make sure that kubernetes allocated resources are enought to start all of the replicas!

### Get access to Teamcity server

Due to Minikube tunnel is running, after the deploy of Teamcity to kuberentes cluster you will be able to connect to servers via LoadBalancer services. All services extentalIp fields will be equal to `127.0.0.1` value, so to connect to Teamcity just open `localhost:TEAMCITY_SERVICE_PORT` in your browser command line. It takes some time to start server in Teamcity docker container, so you might have to wait 1-2 minutes to start working via WebUI.

## Backup and restore Teamcity server instances

Each Teamcity server has own database in Postgresql as extrenal database. Also for each database new database role is created with own password. Each Teamcity server has an access only to own database to store data in it. Database is used to store
server data as well as to backup TC server instance. All needed tables are created in database after the first Teamcity server connection. If Teamcity pod is terminated for some reason it would be restarted and restoring data from database option will be suggested to user via WebUI. Thus, Teamcity server stores the state in extenral database even if there are problems with Teamcity pods (for instance pod eviction).

## Future recomendation to deploy to production environemts.

If suggested infrastructure is deployed in the cloud there are several steps to implement the future:

1. Using services with type `LoadBalancer` for Teamcity servers is OK to expose it for Minikube, but in real environment it leads to creation a big amount of real load balancers in the cloud. If is sutable for you can use lb addresses to have an access to Teamcity servers. But if it is unacceptable for you, for instance if you have a strong limit of resources in your cloud account, you may need to create ingress to get an access to Teamcity servers instead of LoadBalancer services.
1. Using `LoadBalancer` in Posgresql is needed only for database provider creation, in common case service has to be availiable only internally. In common case Posgresql should be located outside Kubernetes cluster, for example in AWS RDS cluster.
1. Apply Teamcity agent into helm chart and install defined amount Teamcity agents replicas. Also to run jobs in the same kubernetes cluster Teamcity server plugin is needed. Installation can be done via init container by analogy with server drivers installation.
1. Monitoing and logging systems should collect metrics data and logs from Teamcity servers to collect information about servers behaviour.
1. Also some values of Teamcity server should be parametrized, like pod resources or environement variables. It allows you to create servers with different parameters for testing purposes. These parameters can be set in Pulumi config file and forwarded to Teamcity constructor.
