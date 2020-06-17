import * as tl from 'azure-pipelines-task-lib';
import fs from 'fs';
import { OnboardingServices } from 'azure-devops-onboarding';

import { TeamProject, WebApiTeam } from "azure-devops-node-api/interfaces/CoreInterfaces";
import { IRoles } from "azure-devops-onboarding/lib/interfaces/IRoles";
import { SubjectType } from "azure-devops-onboarding/lib/interfaces/Enums";

let onboarding: OnboardingServices;

async function run() {
    const AZUREDEVOPS_PAT: string = tl.getVariable("AZUREDEVOPS_PAT")!;
    const AZUREDEVOPS_PAT_OWNER: string = tl.getVariable("AZUREDEVOPS_PAT_OWNER")!;
    const MS_GRAPH_APP_SECERET: string = tl.getVariable("MS_GRAPH_APP_TOKEN")!;
    const TESTING: boolean = JSON.parse(tl.getVariable("TESTING")!);

    onboarding = new OnboardingServices(AZUREDEVOPS_PAT, AZUREDEVOPS_PAT_OWNER, MS_GRAPH_APP_SECERET, TESTING);

    const action: string = tl.getInput("Action", true)!;
    const projectName: string = tl.getInput("ProjectName", true)!;
    const description: string = tl.getInput("Description", true)!;
    try {
        switch (action) {
            case 'onboardProject': {
                const project = await onboarding.project().getProject(projectName);
                if (project) {
                    throw Error("Project already exists.");
                }
                else {
                    await onboardValueStream(projectName, description);
                }
                break;
            }
            case 'onboardTeam': {
                const teamName: string = tl.getInput("TeamName", true)!;
                const project = await onboarding.project().getProject(projectName);
                if (!project) {
                    throw Error("Project '" + projectName + "' does not exists.");
                }
                const team = await onboarding.team().getTeam(project, onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName);
                if (team) {
                    throw Error("Team '" + teamName + "' already exists. Did not onboard the team.");
                }
                else {
                    await onboardTeam(project, teamName, description);
                }
                break;
            }
        }
        tl.setResult(tl.TaskResult.Succeeded, "Onboarding complete.", true)!;
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, "Error while executing action :" + action + err.stack, true);
    }
}

run();

async function onboardValueStream(name: string, description: string): Promise<void> {
    console.log("Started onboarding Project '" + name + "'");
    try {
        const project: TeamProject = await onboarding.project().createProject(name, description, false, false, true);

        // Populate Reader Group
        const aadGroupName = onboarding.configuration().AAD_PROJECT_READER_GROUP_PREFIX + name + "-Readers";
        await onboarding.microsoftGraphServices().CreateOrGetAADGroup(aadGroupName, project.name);
        await onboarding.group().addAADGroupMemberToAzureDevOpsGroup(project, "Readers", aadGroupName);

        // Create Project Security Roles
        const roles: IRoles = JSON.parse(fs.readFileSync('settings/roles.json', 'utf8'));

        for (var securityRole of roles.SecurityRoles) {
            await onboarding.group().createSecurityGroupAndAddToContributors(project, securityRole.SecurityGroup, securityRole.Description);
        }
        await onboarding.project().deleteProjectCreationMess(project, "Administration");
        await onboarding.group().deleteMemberFromGroup(project, "Contributors", project.name + " Team", SubjectType.Group);

        await onboarding.wiki().initializeProjectWiki(project);
        await onboarding.project().setDefaultProjectSecurity(project);
        await onboarding.policy().applyOrReplaceGitPolicies(project);

        await onboarding.library().createOrUpdateVariableGroupForProject(project);
        const sharedResourcesProject = await onboarding.project().getProject("Community");
        await onboarding.serviceConnection().shareAndAuthorizeServiceConnection(sharedResourcesProject, "SC-Community", project);
        await onboarding.agentPool().setDefaultSecurityForSpecifiedPipelines(project, onboarding.configuration().DEFAULTAGENTQUEUES, true);
    }
    catch (err) {
        throw Error("Error while onboard project. " + err);
    }
}

async function onboardTeam(project: TeamProject, teamName: string, description: string): Promise<void> {
    console.log("Started onboarding Team '" + teamName + "'");
    try {
        const team = await onboarding.team().createTeam(project, onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName, description);

        const roles: IRoles = JSON.parse(fs.readFileSync('settings/roles.json', 'utf8'));

        for (var securityRole of roles.SecurityRoles) {
            const aadGroupName = (onboarding.configuration().AAD_TEAM_GROUP_PREFIX + teamName + "-" + securityRole.PostFixName).replace(' ', '');;
            const SecurityGroupName = onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName + " " + securityRole.PostFixName;

            await onboarding.microsoftGraphServices().CreateOrGetAADGroup(aadGroupName, project.name);
            await onboarding.group().createGroup(project, SecurityGroupName, securityRole.Description)
            await onboarding.group().addAADGroupMemberToAzureDevOpsGroup(project, SecurityGroupName, aadGroupName);
            await onboarding.group().addMemberToGroup(project, SecurityGroupName, securityRole.SecurityGroup);
            await onboarding.group().addMemberToGroup(project, SecurityGroupName, onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName);
        }

        // Add team to Value Stream Team
        await onboarding.group().addMemberToGroup(project, onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName, project.name + " Team");
        await onboarding.team().changeTeamAdmin(project, onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName, onboarding.configuration().AZURE_DEVOPS_TEAM_GROUP_PREFIX + teamName + " Adm");
        await onboarding.team().createObjectsAndSetSecurity(project, team);
    }
    catch (err) {
        throw Error("Error while onboard project. " + err);
    }
}