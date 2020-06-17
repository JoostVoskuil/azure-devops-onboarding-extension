# The Azure DevOps Onboarding Example Extension

The Azure DevOps Onboarding Extension is an example extension (written in typescript) to inspire you how to create an onboarding flow using the 'Azure DevOps Onboarding API'. It is part of three git repositories. See [Git Repository](https://github.com/JoostVoskuil/azure-devops-onboarding/README.md) for more information.

## Onboarding task

The onboarding task is to onboard:

- Value streams
- Teams in Value Streams

Because this rely heavely on creating AAD groups, this should be done by a seperate team that is responsible for onboarding value streams and teams.

## Self-service task

Users an use the self-service task to create:

- Products inside Value streams
- Onboard teams to products
- Innersouce other teams from different Value Streams to an product
- Harden objects like variable groups, git repositories for particulair products or teams

My idea is that users can use those pipelines and change the input with the variable options. See [Git Repository](https://github.com/JoostVoskuil/azure-devops-onboarding/README.md) for the pipelines. Security is done by checking the groups where the requester is member of. The pipelines / team project where these pipelines are run needs to be hardenend (that is, the teams/users cannot create pipelines or alter them) since it is using a PAT from a highly priviledged user.

## Adoption

The code is made this way that you can customize and publish your own private extension. This is the reason why it is not offered in the marketplace. Use the azure-pipelines.yml and import variablegroup 'variablegroup.json' to set your own publisher, extensionId and newly random taskId Guids.
