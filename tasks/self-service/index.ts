import * as tl from 'azure-pipelines-task-lib';
import fs from 'fs';
import { OnboardingServices } from 'azure-devops-onboarding';

import { GroupType } from 'azure-devops-onboarding/lib/interfaces/Enums';
import { IRoles } from "azure-devops-onboarding/lib/interfaces/IRoles";

let onboarding: OnboardingServices;

async function run() {
    const AZUREDEVOPS_PAT: string = tl.getVariable("AZUREDEVOPS_PAT")!;
    const AZUREDEVOPS_PAT_OWNER: string = tl.getVariable("AZUREDEVOPS_PAT_OWNER")!;
    const MS_GRAPH_APP_SECERET: string = tl.getVariable("MS_GRAPH_APP_TOKEN")!;
    const TESTING: boolean = JSON.parse(tl.getVariable("TESTING")!);

    onboarding = new OnboardingServices(AZUREDEVOPS_PAT, AZUREDEVOPS_PAT_OWNER, MS_GRAPH_APP_SECERET, TESTING);

    const action: string = tl.getInput("Action", true)!;


    console.log("Started action: " + action);
    try {
        switch (action) {
            case 'onboardProduct': {
                const projectName = tl.getInput("ProjectName", true)!;
                const productName = tl.getInput("ProductName", true)!;
                const description = tl.getInput("Description", true)!;
                await onboardProduct(projectName, productName, description)
                break;
            }
            case 'onboardInnerSourceTeamOnProduct': {
                const targetProjectName = tl.getInput("ProjectName", true)!;
                const sourceProjectName = tl.getInput("SourceProjectName", true)!;
                const productName = tl.getInput("ProductName", true)!;
                const sourceTeamName = tl.getInput("SourceTeamName", true)!;
                await onboardInnerSourceTeamOnProduct(sourceProjectName, sourceTeamName, targetProjectName, productName)
                break;
            }
            case 'onboardTeamToProduct': {
                const projectName = tl.getInput("ProjectName", true)!;
                const productName = tl.getInput("ProductName", true)!;
                const teamName = tl.getInput("TeamName", true)!;
                await onboardTeamToProduct(projectName, teamName, productName)
                break;
            }
            case 'onboardApprovalGroup': {
                const projectName = tl.getInput("ProjectName", true)!;
                const productName = tl.getInput("ProductName", true)!;
                const description = tl.getInput("Description", true)!;
                const approvalName = tl.getInput("ApprovalName", true)!;
                await onboardApprovalGroup(projectName, productName, approvalName, description)
                break;
            }
            case 'hardenVariableGroup': {
                const projectName = tl.getInput("ProjectName", true)!;
                const objectName = tl.getInput("ObjectName", true)!;
                const groupName = tl.getInput("GroupName", true)!;
                const groupType = tl.getInput("GroupType", true)!;
                await hardenVariableGroup(projectName, objectName, groupName, GroupType[groupType]);
                break;
            }
            case 'hardenGitRepository': {
                const projectName = tl.getInput("ProjectName", true)!;
                const objectName = tl.getInput("ObjectName", true)!;
                const groupName = tl.getInput("GroupName", true)!;
                const groupType = tl.getInput("GroupType", true)!;
                await hardenGitRepository(projectName, objectName, groupName, GroupType[groupType]);
                break;
            }
            case 'hardenEnvironment': {
                const projectName = tl.getInput("ProjectName", true)!;
                const objectName = tl.getInput("ObjectName", true)!;
                const groupName = tl.getInput("GroupName", true)!;
                const groupType = tl.getInput("GroupType", true)!;
                await hardenEnvironment(projectName, objectName, groupName, GroupType[groupType]);
                break;
            }
            case 'hardenServiceConnection': {
                const projectName = tl.getInput("ProjectName", true)!;
                const objectName = tl.getInput("ObjectName", true)!;
                const groupName = tl.getInput("GroupName", true)!;
                const groupType = tl.getInput("GroupType", true)!;
                await hardenServiceConnection(projectName, objectName, groupName, GroupType[groupType]);
                break;
            }
            case 'hardenDeploymentGroup': {
                const projectName = tl.getInput("ProjectName", true)!;
                const objectName = tl.getInput("ObjectName", true)!;
                const groupName = tl.getInput("GroupName", true)!;
                const groupType = tl.getInput("GroupType", true)!;
                await hardenDeploymentGroup(projectName, objectName, groupName, GroupType[groupType]);
                break;
            }

        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, "Error while executing action :" + action + "/" + err.stack, true);
    }

    tl.setResult(tl.TaskResult.Succeeded, "finished.", true);
}

run();

async function onboardProduct(projectName: string, productName: string, description: string): Promise<void> {
    const project = await onboarding.project().getProject(projectName);
    if (!project) {
        throw Error("Project '" + projectName + "' does not exists.")
    }
    const SecurityGroupName = onboarding.configuration().AZURE_DEVOPS_PRODUCT_GROUP_PREFIX + productName;
    const checkIfGroupExists: boolean = await onboarding.group().checkIfGroupExists(project, SecurityGroupName, GroupType.Product);
    if (checkIfGroupExists) {
        throw Error("Product '" + productName + "' already exists. Did not onboard the product.");
    }

    await onboarding.group().createGroup(project, SecurityGroupName, description)
    await onboarding.pipeline().createBuildFolderAndSetPermissions(project, onboarding.configuration().AZURE_DEVOPS_PRODUCT_GROUP_PREFIX + productName, "buildfolderpermissions.json");
    await onboarding.release().createReleaseFolderAndSetPermissions(project, onboarding.configuration().AZURE_DEVOPS_PRODUCT_GROUP_PREFIX + productName, "releasefolderpermissions.json");
    await onboarding.library().createProductVariableGroup(project, productName);
    await onboarding.dashboard().createProductDashboard(project, productName);
}

async function onboardInnerSourceTeamOnProduct(sourceProjectName: string, sourceTeam: string, targetProjectName: string, targetProduct: string): Promise<void> {
    const sourceProject = await onboarding.project().getProject(sourceProjectName);
    const targetProject = await onboarding.project().getProject(targetProjectName);
    if (!sourceProject) {
        throw Error("Project '" + sourceProject + "' does not exists.");
    }
    if (!targetProject) {
        throw Error("Project '" + targetProject + "' does not exists.");
    }

    const innerSourceGroupName = onboarding.configuration().AZURE_DEVOPS_PRODUCT_GROUP_PREFIX + targetProduct + " - " + sourceTeam + " from " + sourceProject.name;
    const checkIfInnerSourcingAlreadyDone = await onboarding.group().checkIfGroupExists(targetProject, innerSourceGroupName, GroupType.Project);
    const checkIfGroupExists: boolean = await onboarding.group().checkIfGroupExists(targetProject, targetProduct, GroupType.Product);
    const checkIfTeamExists: boolean = await onboarding.group().checkIfGroupExists(sourceProject, sourceTeam, GroupType.Team);
    if (!checkIfGroupExists) {
        throw Error("Project '" + targetProduct + "' does not exists.");
    }
    if (!checkIfTeamExists) {
        throw Error("Team '" + sourceTeam + "' does not exists. Did not create the innersourcing group.");
    }
    if (checkIfInnerSourcingAlreadyDone) {
        throw Error("Team '" + sourceTeam + "' is already part of product '" + targetProduct + "'");
    }

    const requestor = tl.getVariable("Build.RequestedForEmail")!;
    console.log("User '" + requestor + "' requested this action.");

    const isAllowed: boolean = await onboarding.user().isUserMemberOfGroup(targetProject, requestor, targetProduct, GroupType.Product);
    if (!isAllowed) {
        throw Error("' is not member of this product. You can only innersource/onboard when you are a member.");
    }

    await onboarding.group().createGroup(targetProject, innerSourceGroupName, "Innersource team: " + sourceProject.name + "\\" + sourceTeam + " on product " + targetProduct);
    await onboarding.group().addMemberToGroup(targetProject, innerSourceGroupName, onboarding.configuration().AZURE_DEVOPS_PRODUCT_GROUP_PREFIX + targetProduct);

    // Create Project Security Roles
    const roles: IRoles = JSON.parse(fs.readFileSync('settings/roles.json', 'utf8'));

    for (var securityRole of roles.SecurityRoles) {
        const aadGroupName = (onboarding.configuration().AAD_TEAM_GROUP_PREFIX + sourceTeam + "-" + securityRole.PostFixName).replace(' ', '');
        await onboarding.group().addAADGroupMemberToAzureDevOpsGroup(targetProject, innerSourceGroupName, aadGroupName);
    }
}

async function onboardTeamToProduct(projectName: string, teamName: string, productName: string): Promise<void> {
    const project = await onboarding.project().getProject(projectName);

    if (!project) {
        throw Error("Project '" + projectName + "' does not exists.");
    }

    teamName = onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName;
    productName = onboarding.configuration().AZURE_DEVOPS_PRODUCT_GROUP_PREFIX + productName;
    const checkIfTeamExists: boolean = await onboarding.group().checkIfGroupExists(project, teamName, GroupType.Project);
    const checkIfProductExists: boolean = await onboarding.group().checkIfGroupExists(project, productName, GroupType.Project);

    if (!checkIfTeamExists) {
        throw Error("Team '" + teamName + "' did not exists.");
    }
    if (!checkIfProductExists) {
        throw Error("Product '" + productName + "' did not exists.");
    }

    const requestor = tl.getVariable("Build.RequestedForEmail")!;
    console.log("User '" + requestor + "' requested this action.");

    const isAllowed: boolean = await onboarding.user().isUserMemberOfGroup(project, requestor, productName, GroupType.Project);
    const numberOfMembers: number = await onboarding.group().getNumberOfMembersOfGroup(project, productName, GroupType.Project);
    if (!isAllowed && numberOfMembers > 0) {
        throw Error("'" + requestor + "' is not member of this product. You can only onboard teams when you are a already a member.");
    }
    await onboarding.group().addMemberToGroup(project, teamName, productName);
}

async function onboardApprovalGroup(projectName: string, productName: string, approvalName: string, description: string): Promise<void> {
    const project = await onboarding.project().getProject(projectName);

    if (!project) {
        throw Error("Project '" + projectName + "' does not exists.");
    }
    const checkIfProductExists: boolean = await onboarding.group().checkIfGroupExists(project, productName, GroupType.Product);

    if (!checkIfProductExists) {
        throw Error("Product '" + productName + "' does not exists.");
    }
    const aadGroupName = (onboarding.configuration().AAD_PRODUCT_GROUP_PREFIX + productName + "_" + approvalName).replace(' ', '');
    const groupName = onboarding.configuration().AZURE_DEVOPS_PRODUCT_GROUP_PREFIX + productName + " " + approvalName;
    const checkIfApprovalGroupExists: boolean = await onboarding.group().checkIfGroupExists(project, groupName, GroupType.Project)
    if (checkIfApprovalGroupExists) {
        throw Error("Approvalgroup '" + groupName + "' already exists. Did not create the approval group.");
    }

    const requestor = tl.getVariable("Build.RequestedForEmail")!;
    console.log("User '" + requestor + "' requested this action.");

    const isAllowed: boolean = await onboarding.user().isUserMemberOfGroup(project, requestor, productName, GroupType.Product);
    if (!isAllowed) {
        throw Error("'" + requestor + "' is not member of this product");
    }

    await onboarding.microsoftGraphServices().CreateOrGetAADGroup(aadGroupName, "Approval group for Azure DevOps");
    await onboarding.group().createGroup(project, groupName, description);
    await onboarding.group().addAADGroupMemberToAzureDevOpsGroup(project, groupName, aadGroupName);
}


async function hardenVariableGroup(projectName: string, objectName: string, groupName: string, groupType: GroupType): Promise<void> {
    const project = await onboarding.project().getProject(projectName);
    const isAllowed: boolean = await checkIfAllowedToHarden(projectName, groupName, groupType);

    if (isAllowed) {
        await onboarding.library().hardenVariableGroup(project, objectName, groupName, groupType);
    }
}

async function hardenGitRepository(projectName: string, objectName: string, groupName: string, groupType: GroupType): Promise<void> {
    const project = await onboarding.project().getProject(projectName);
    const isAllowed: boolean = await checkIfAllowedToHarden(projectName, groupName, groupType);

    if (isAllowed) {
        await onboarding.gitRepo().hardenGitRepository(project, objectName, groupName, groupType);
    }
}

async function hardenEnvironment(projectName: string, objectName: string, groupName: string, groupType: GroupType): Promise<void> {
    const project = await onboarding.project().getProject(projectName);
    const isAllowed: boolean = await checkIfAllowedToHarden(projectName, groupName, groupType);

    if (isAllowed) {
        await onboarding.environment().hardenEnvironment(project, objectName, groupName, groupType);
    }
}

async function hardenServiceConnection(projectName: string, objectName: string, groupName: string, groupType: GroupType): Promise<void> {
    const project = await onboarding.project().getProject(projectName);
    const isAllowed: boolean = await checkIfAllowedToHarden(projectName, groupName, groupType);

    if (isAllowed) {
        await onboarding.serviceConnection().hardenServiceConnection(project, objectName, groupName, groupType);
    }
}

async function hardenDeploymentGroup(projectName: string, objectName: string, groupName: string, groupType: GroupType): Promise<void> {
    const project = await onboarding.project().getProject(projectName);
    const isAllowed: boolean = await checkIfAllowedToHarden(projectName, groupName, groupType);

    if (isAllowed) {
        await onboarding.deploymentGroup().hardenDeploymentGroup(project, objectName, groupName, groupType);
    }
}


async function checkIfAllowedToHarden(projectName: string, groupName: string, groupType: GroupType): Promise<boolean> {
    const project = await onboarding.project().getProject(projectName);

    if (!project) {
        throw Error("Project '" + projectName + "' does not exists.");
    }
    const checkIfGroupExists: boolean = await onboarding.group().checkIfGroupExists(project, groupName, groupType);

    if (!checkIfGroupExists) {
        throw Error("Team/Product '" + groupName + "' does not exists.");
    }

    const requestor = tl.getVariable("Build.RequestedForEmail")!;
    console.log("User '" + requestor + "' requested this action.");

    const isAllowed: boolean = await onboarding.user().isUserMemberOfGroup(project, requestor, groupName, groupType);
    if (!isAllowed) {
        throw Error("'" + requestor + "' is not member of this product");
    }
    return true;
}