ALTER TABLE "tentix"."users" ADD COLUMN "meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_meta" ON "tentix"."users" USING gin ("meta");--> statement-breakpoint

-- 创建默认管理员用户
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    -- 检查是否已存在 admin 用户
    SELECT id INTO admin_user_id 
    FROM "tentix"."users" 
    WHERE "name" = 'admin';
    
    -- 如果不存在则创建
    IF admin_user_id IS NULL THEN
        -- 插入管理员用户
        INSERT INTO "tentix"."users" (
            "name",
            "nickname",
            "real_name",
            "phone_num",
            "role",
            "avatar",
            "register_time",
            "level",
            "email",
            "force_relogin",
            "meta"
        ) VALUES (
            'admin',
            'admin',
            'admin',
            '',
            'admin',
            '',
            CURRENT_TIMESTAMP,
            0,
            '',
            false,
            '{}'::jsonb
        ) RETURNING id INTO admin_user_id;
        
        -- 插入密码登录方式
        INSERT INTO "tentix"."user_identities" (
            "user_id",
            "provider",
            "provider_user_id",
            "metadata",
            "is_primary",
            "created_at",
            "updated_at"
        ) VALUES (
            admin_user_id,
            'password',
            'admin',
            '{"password": {"needReset": true, "passwordHash": "jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI="}}'::jsonb,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE '默认管理员用户创建成功，用户ID: %', admin_user_id;
    ELSE
        RAISE NOTICE '管理员用户已存在，跳过创建';
    END IF;
END $$;