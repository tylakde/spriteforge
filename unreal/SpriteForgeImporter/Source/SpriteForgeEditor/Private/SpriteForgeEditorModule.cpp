#include "Modules/ModuleManager.h"
#include "ToolMenus.h"
#include "DesktopPlatformModule.h"
#include "IDesktopPlatform.h"
#include "Framework/Application/SlateApplication.h"
#include "Misc/MessageDialog.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "SpriteForgeImportService.h"
#include "SpriteForgeMetadata.h"
#include "SpriteForgeCharacterAsset.h"
#include "AssetToolsModule.h"
class FSpriteForgeEditorModule : public IModuleInterface {
public:
    virtual void StartupModule() override {UToolMenus::RegisterStartupCallback(FSimpleMulticastDelegate::FDelegate::CreateRaw(this,&FSpriteForgeEditorModule::RegisterMenus));}
    virtual void ShutdownModule() override {UToolMenus::UnRegisterStartupCallback(this);UToolMenus::UnregisterOwner(this);}
private:
    void RegisterMenus() {
        FToolMenuOwnerScoped Owner(this);
        UToolMenu* Menu=UToolMenus::Get()->ExtendMenu(TEXT("LevelEditor.MainMenu.Tools"));
        FToolMenuSection& Section=Menu->FindOrAddSection(TEXT("SpriteForge"));
        Section.AddMenuEntry(TEXT("ImportSpriteForgeCharacter"),FText::FromString(TEXT("Import SpriteForge Character…")),FText::FromString(TEXT("Import a complete directional character package.")),FSlateIcon(),FUIAction(FExecuteAction::CreateRaw(this,&FSpriteForgeEditorModule::ImportCharacter)));
        Section.AddMenuEntry(TEXT("ImportSpriteForge"),FText::FromString(TEXT("Import SpriteForge Asset…")),FText::FromString(TEXT("Import a SpriteForge JSON atlas export.")),FSlateIcon(),FUIAction(FExecuteAction::CreateRaw(this,&FSpriteForgeEditorModule::Import)));
    }
    void ImportCharacter() {
        auto* Desktop=FDesktopPlatformModule::Get();if(!Desktop)return;
        const void* Parent=FSlateApplication::Get().FindBestParentWindowHandleForDialogs(nullptr);
        TArray<FString> Files;if(!Desktop->OpenFileDialog(Parent,TEXT("Import SpriteForge Character"),TEXT(""),TEXT(""),TEXT("Character JSON (*.character.json)|*.character.json"),0,Files)||Files.IsEmpty())return;
        FString Error;
        if(auto* Asset=SpriteForgeImportService::ImportCharacter(Files[0],Error)) {
            TArray<UObject*> Assets={Asset};FModuleManager::LoadModuleChecked<FAssetToolsModule>(TEXT("AssetTools")).Get().SyncBrowserToAssets(Assets);
            FMessageDialog::Open(EAppMsgType::Ok,FText::FromString(TEXT("Character imported. Drop a SpriteForgeCharacterExample into the level, assign Character Asset, then press Play for WASD, Shift and attack.")));
        } else FMessageDialog::Open(EAppMsgType::Ok,FText::FromString(Error));
    }
    void Import() {
        IDesktopPlatform* Desktop=FDesktopPlatformModule::Get();if(!Desktop)return;
        const void* Parent=FSlateApplication::Get().FindBestParentWindowHandleForDialogs(nullptr);
        TArray<FString> Files;if(!Desktop->OpenFileDialog(Parent,TEXT("Import SpriteForge metadata"),TEXT(""),TEXT(""),TEXT("SpriteForge JSON (*.json)|*.json"),0,Files)||Files.IsEmpty())return;
        FString Text,Error,AtlasOverride;FSpriteForgeDocument Doc;
        if(!FFileHelper::LoadFileToString(Text,*Files[0])||!SpriteForgeMetadata::Parse(Text,Doc,Error)){FMessageDialog::Open(EAppMsgType::Ok,FText::FromString(Error.IsEmpty()?TEXT("Could not read metadata."):Error));return;}
        if(!FPaths::FileExists(FPaths::Combine(FPaths::GetPath(Files[0]),Doc.AtlasFile))){TArray<FString> Atlas;if(!Desktop->OpenFileDialog(Parent,TEXT("Locate atlas PNG"),FPaths::GetPath(Files[0]),Doc.AtlasFile,TEXT("PNG (*.png)|*.png"),0,Atlas)||Atlas.IsEmpty())return;AtlasOverride=Atlas[0];}
        if(USpriteForgeAsset* Asset=SpriteForgeImportService::Import(Files[0],AtlasOverride,Error)){
            TArray<UObject*> Assets={Asset};FModuleManager::LoadModuleChecked<FAssetToolsModule>(TEXT("AssetTools")).Get().SyncBrowserToAssets(Assets);
            FMessageDialog::Open(EAppMsgType::Ok,FText::FromString(TEXT("Imported SpriteForge assets into /Game/SpriteForge/")+Doc.Asset+TEXT(". Add a SpriteForgeImpostorActor to your level and assign its Sprite Asset.")));
        }else FMessageDialog::Open(EAppMsgType::Ok,FText::FromString(TEXT("SpriteForge import failed: ")+Error));
    }
};
IMPLEMENT_MODULE(FSpriteForgeEditorModule,SpriteForgeEditor)
