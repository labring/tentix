import { readConfig } from "@/utils/env.ts";
import {
  getFeishuAppAccessToken,
  getFeishuDepartmentsInfo,
  getFeishuUserInfoByDepartment,
} from "@/utils/platform/index.ts";
import { logError, withTaskLog, logComplete } from "../utils/log.ts";
import { AppConfig } from "@/utils/types.ts";
import { styleText } from "util";

async function main() {
  try {
    // Step 1: Read configuration
    const appConfig = await withTaskLog("Reading configuration", async () => {
      return await readConfig();
    });

    // Step 2: Get Feishu access token
    const { tenant_access_token } = await withTaskLog(
      "Getting Feishu access token",
      async () => {
        return await getFeishuAppAccessToken();
      },
    );

    // Step 3: Get departments information
    const departmentsRes = await withTaskLog(
      "Fetching departments information",
      async () => {
        return await getFeishuDepartmentsInfo(
          appConfig.department_ids,
          tenant_access_token,
        );
      },
    );

    type Department = {
      openId: string;
      id: string;
      name: string;
      members: string[];
    };

    const departmentsList: Department[] = departmentsRes.data.items.map(
      (item) => {
        return {
          openId: item.open_department_id,
          id: item.department_id,
          name: item.name,
          members: [],
        };
      },
    );

    type Staff = {
      avatar: string;
      description: string;
      name: string;
      nickname?: string;
      open_id: string;
      union_id: string;
      user_id: string;
    };

    // Step 4: Get staff information for each department
    let staffsList: Staff[] = [];
    await withTaskLog("Fetching staff information", async () => {
      for (const department of departmentsRes.data.items) {
        const staffs = (
          await getFeishuUserInfoByDepartment(
            department.open_department_id,
            tenant_access_token,
          )
        ).data.items;
        departmentsList.find(
          (item) => item.id === department.department_id,
        )!.members = staffs.map((staff) => staff.union_id);
        staffsList = staffsList.concat(
          staffs.map((staff) => {
            return {
              avatar: staff.avatar.avatar_72,
              description: staff.description,
              name: staff.name,
              nickname: staff.nickname,
              open_id: staff.open_id,
              union_id: staff.union_id,
              user_id: staff.user_id,
            };
          }),
        );
      }
    });
    let newAppConfig: AppConfig;
    // Step 5: Generate and save new configuration

    await withTaskLog("Saving new configuration", async () => {
      newAppConfig = Object.assign(appConfig, {
        departments: departmentsList,
        staffs: staffsList,
      });
      await Bun.write(
        "config.dev.json",
        JSON.stringify(newAppConfig, null, 2),
      );
      console.log(
        Bun.inspect.table(
          [
            {
              name: "All Departments",
              memberNumber: newAppConfig.staffs.length,
            },
            ...newAppConfig.departments.map((item) => ({
              openId: item.openId,
              name: item.name,
              memberNumber: item.members.length,
            })),
          ],
          { colors: true },
        ),
      );
      if (newAppConfig.staffs.length !== staffsList.length) {
        console.warn(
          styleText(
            ["bgRedBright"],
            `Staff number had been changed! Previous: ${appConfig.staffs.length}, Current: ${newAppConfig.staffs.length}.\n Changed staffs: ${newAppConfig.staffs
              .filter((item) => !appConfig.staffs.includes(item))
              .map((item) => item.name)
              .join(", ")} \n If this is first time to run this script, don't worry about this.`,
          ),
        );
      }
    });

    logComplete("Staff list migration completed successfully!");

    process.exit(0);
  } catch (error) {
    logError("Staff list migration failed", error);
    process.exit(1);
  }
}

main();
