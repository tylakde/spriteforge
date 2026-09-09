using UnrealBuildTool;
public class SpriteForgeEditor : ModuleRules {
    public SpriteForgeEditor(ReadOnlyTargetRules Target) : base(Target) {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "SpriteForgeRuntime" });
        PrivateDependencyModuleNames.AddRange(new[] { "UnrealEd", "AssetTools", "AssetRegistry", "Json", "JsonUtilities", "ToolMenus", "Slate", "SlateCore", "DesktopPlatform", "MainFrame", "MaterialEditor", "Projects" });
    }
}
