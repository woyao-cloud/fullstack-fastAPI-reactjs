## commits cae4272..d1e9ac1
d1e9ac1 fix(config): ConfigHistory.changed_at 加索引 + 测试断言

## diff -U8
diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
index 44d4b45..c8b7d77 100644
--- a/user-service/back-end/app/domain/models/system_config.py
+++ b/user-service/back-end/app/domain/models/system_config.py
@@ -29,17 +29,17 @@ class SystemConfig(Base):
 class ConfigHistory(Base):
     __tablename__ = "config_history"
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
     config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
     old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
     new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
     changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
-    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
+    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
 
 
 class EmailTemplate(Base):
     __tablename__ = "email_template"
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
     template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
     template_name: Mapped[str] = mapped_column(String(100), nullable=False)
diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
index d9bb138..2d1b4c7 100644
--- a/user-service/back-end/tests/test_system_config_model.py
+++ b/user-service/back-end/tests/test_system_config_model.py
@@ -20,15 +20,16 @@ def test_system_config_columns():
             "is_encrypted", "description", "updated_by",
             "created_at", "updated_at"} <= cols
     assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
 
 
 def test_config_history_columns():
     cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
     assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
+    assert Base.metadata.tables["config_history"].columns["changed_at"].index is True
 
 
 def test_email_template_columns():
     cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
     assert {"id", "template_code", "template_name", "subject", "content",
             "variables", "is_active", "created_at", "updated_at"} <= cols
     assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
\ No newline at end of file
