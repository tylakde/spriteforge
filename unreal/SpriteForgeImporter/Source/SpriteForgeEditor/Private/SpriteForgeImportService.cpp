#include "SpriteForgeImportService.h"
#include "SpriteForgeMetadata.h"
#include "SpriteForgeAsset.h"
#include "AssetImportTask.h"
#include "AssetToolsModule.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Factories/TextureFactory.h"
#include "Engine/Texture2D.h"
#include "MaterialEditingLibrary.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstanceConstant.h"
#include "Materials/MaterialExpressionTextureCoordinate.h"
#include "Materials/MaterialExpressionTextureSampleParameter2D.h"
#include "Materials/MaterialExpressionVectorParameter.h"
#include "Materials/MaterialExpressionComponentMask.h"
#include "Materials/MaterialExpressionMultiply.h"
#include "Materials/MaterialExpressionAdd.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/PackageName.h"
#include "UObject/SavePackage.h"
#include "HAL/FileManager.h"
namespace {
bool SaveAsset(UObject* Asset,FString& Error) {
    Asset->MarkPackageDirty();UPackage* Package=Asset->GetOutermost();
    const FString Filename=FPackageName::LongPackageNameToFilename(Package->GetName(),FPackageName::GetAssetPackageExtension());
    IFileManager::Get().MakeDirectory(*FPaths::GetPath(Filename),true);
    FSavePackageArgs Args;Args.TopLevelFlags=RF_Public|RF_Standalone;Args.SaveFlags=SAVE_NoError;
    if(!UPackage::SavePackage(Package,Asset,*Filename,Args)){Error=TEXT("Could not save asset: ")+Filename;return false;}return true;
}
template<class T> T* AssetAt(const FString& Folder,const FString& Name,FString& Error) {
    const FString Path=(Folder/Name);
    if(UObject* Existing=LoadObject<UObject>(nullptr,*(Path+TEXT(".")+Name))) {
        T* Result=Cast<T>(Existing);if(!Result)Error=TEXT("An unrelated asset occupies ")+Path;return Result;
    }
    UPackage* Package=CreatePackage(*Path);T* Result=NewObject<T>(Package,*Name,RF_Public|RF_Standalone|RF_Transactional);FAssetRegistryModule::AssetCreated(Result);return Result;
}
template<class T> T* Expression(UMaterial* Material,int32 X,int32 Y) {return CastChecked<T>(UMaterialEditingLibrary::CreateMaterialExpression(Material,T::StaticClass(),X,Y));}
UMaterial* MakeMaterial(UTexture2D* Texture,FString& Error) {
    const FString Folder=TEXT("/Game/SpriteForge/_Shared"),Name=TEXT("M_SpriteForge_Masked");
    if(UMaterial* Existing=LoadObject<UMaterial>(nullptr,*((Folder/Name)+TEXT(".")+Name)))return Existing;
    UMaterial* Material=AssetAt<UMaterial>(Folder,Name,Error);if(!Material)return nullptr;
    Material->BlendMode=BLEND_Masked;Material->SetShadingModel(MSM_Unlit);Material->TwoSided=true;Material->OpacityMaskClipValue=0.333f;
    auto* UV=Expression<UMaterialExpressionTextureCoordinate>(Material,-700,0);
    auto* Scale=Expression<UMaterialExpressionVectorParameter>(Material,-700,160);Scale->ParameterName=TEXT("UVScale");Scale->DefaultValue=FLinearColor(1,1,0,0);
    auto* Offset=Expression<UMaterialExpressionVectorParameter>(Material,-700,340);Offset->ParameterName=TEXT("UVOffset");Offset->DefaultValue=FLinearColor(0,0,0,0);
    auto* ScaleRG=Expression<UMaterialExpressionComponentMask>(Material,-500,160);ScaleRG->R=true;ScaleRG->G=true;ScaleRG->B=false;ScaleRG->A=false;
    auto* OffsetRG=Expression<UMaterialExpressionComponentMask>(Material,-500,340);OffsetRG->R=true;OffsetRG->G=true;OffsetRG->B=false;OffsetRG->A=false;
    auto* Multiply=Expression<UMaterialExpressionMultiply>(Material,-300,0);auto* Add=Expression<UMaterialExpressionAdd>(Material,-100,0);
    auto* Atlas=Expression<UMaterialExpressionTextureSampleParameter2D>(Material,100,0);Atlas->ParameterName=TEXT("Atlas");Atlas->Texture=Texture;Atlas->SamplerType=SAMPLERTYPE_Color;
    UMaterialEditingLibrary::ConnectMaterialExpressions(Scale,TEXT(""),ScaleRG,TEXT("Input"));UMaterialEditingLibrary::ConnectMaterialExpressions(Offset,TEXT(""),OffsetRG,TEXT("Input"));
    UMaterialEditingLibrary::ConnectMaterialExpressions(UV,TEXT(""),Multiply,TEXT("A"));UMaterialEditingLibrary::ConnectMaterialExpressions(ScaleRG,TEXT(""),Multiply,TEXT("B"));
    UMaterialEditingLibrary::ConnectMaterialExpressions(Multiply,TEXT(""),Add,TEXT("A"));UMaterialEditingLibrary::ConnectMaterialExpressions(OffsetRG,TEXT(""),Add,TEXT("B"));UMaterialEditingLibrary::ConnectMaterialExpressions(Add,TEXT(""),Atlas,TEXT("UVs"));
    UMaterialEditingLibrary::ConnectMaterialProperty(Atlas,TEXT("RGB"),MP_EmissiveColor);UMaterialEditingLibrary::ConnectMaterialProperty(Atlas,TEXT("A"),MP_OpacityMask);
    Material->PostEditChange();UMaterialEditingLibrary::RecompileMaterial(Material);
    return SaveAsset(Material,Error)?Material:nullptr;
}
}
USpriteForgeAsset* SpriteForgeImportService::Import(const FString& MetadataPath,const FString& AtlasOverride,FString& Error) {
    FString JSON;if(!FFileHelper::LoadFileToString(JSON,*MetadataPath)){Error=TEXT("Could not read metadata file.");return nullptr;}
    FSpriteForgeDocument Doc;if(!SpriteForgeMetadata::Parse(JSON,Doc,Error))return nullptr;
    const FString AtlasPath=AtlasOverride.IsEmpty()?FPaths::Combine(FPaths::GetPath(MetadataPath),Doc.AtlasFile):AtlasOverride;
    if(!FPaths::FileExists(AtlasPath)){Error=TEXT("Atlas PNG was not found: ")+AtlasPath;return nullptr;}
    // Validate PNG signature and size before replacing an existing texture.
    TArray<uint8> Header;if(!FFileHelper::LoadFileToArray(Header,*AtlasPath)||Header.Num()<24){Error=TEXT("Atlas is not a readable PNG.");return nullptr;}
    const uint8 Signature[]={137,80,78,71,13,10,26,10};
    if(FMemory::Memcmp(Header.GetData(),Signature,8)!=0){Error=TEXT("Atlas is not a PNG file.");return nullptr;}
    auto BE=[&Header](int32 I)->uint32{return (uint32(Header[I])<<24)|(uint32(Header[I+1])<<16)|(uint32(Header[I+2])<<8)|Header[I+3];};
    if(BE(16)!=uint32(Doc.AtlasSize.X)||BE(20)!=uint32(Doc.AtlasSize.Y)){Error=TEXT("PNG dimensions do not match metadata.");return nullptr;}
    const FString Folder=TEXT("/Game/SpriteForge/")+Doc.Asset,TextureName=TEXT("T_")+Doc.Asset+TEXT("_Atlas");
    if(UObject* Existing=LoadObject<UObject>(nullptr,*(Folder/TextureName+TEXT(".")+TextureName));Existing&&!Existing->IsA<UTexture2D>()){Error=TEXT("An unrelated asset occupies the atlas destination.");return nullptr;}
    UAssetImportTask* Task=NewObject<UAssetImportTask>();Task->Filename=AtlasPath;Task->DestinationPath=Folder;Task->DestinationName=TextureName;Task->bAutomated=true;Task->bReplaceExisting=true;Task->bSave=false;Task->Factory=NewObject<UTextureFactory>();
    FModuleManager::LoadModuleChecked<FAssetToolsModule>(TEXT("AssetTools")).Get().ImportAssetTasks({Task});
    UTexture2D* Texture=nullptr;for(UObject* Object:Task->GetObjects())if((Texture=Cast<UTexture2D>(Object)))break;
    if(!Texture){Error=TEXT("Unreal could not import the atlas texture.");return nullptr;}
    Texture->SRGB=true;Texture->CompressionSettings=TC_EditorIcon;Texture->MipGenSettings=TMGS_NoMipmaps;Texture->AddressX=TA_Clamp;Texture->AddressY=TA_Clamp;Texture->Filter=TF_Bilinear;Texture->LODGroup=TEXTUREGROUP_Pixels2D;Texture->NeverStream=true;Texture->PostEditChange();
    if(!SaveAsset(Texture,Error))return nullptr;
    UMaterial* Material=MakeMaterial(Texture,Error);if(!Material)return nullptr;
    UMaterialInstanceConstant* Instance=AssetAt<UMaterialInstanceConstant>(Folder,TEXT("MI_")+Doc.Asset+TEXT("_Impostor"),Error);if(!Instance)return nullptr;
    Instance->SetParentEditorOnly(Material);Instance->SetTextureParameterValueEditorOnly(TEXT("Atlas"),Texture);
    const auto& First=Doc.Frames[0];Instance->SetVectorParameterValueEditorOnly(TEXT("UVScale"),FLinearColor(First.UVSize.X,First.UVSize.Y,0,0));Instance->SetVectorParameterValueEditorOnly(TEXT("UVOffset"),FLinearColor(First.UVOrigin.X,First.UVOrigin.Y,0,0));Instance->PostEditChange();if(!SaveAsset(Instance,Error))return nullptr;
    USpriteForgeAsset* Asset=AssetAt<USpriteForgeAsset>(Folder,TEXT("DA_")+Doc.Asset+TEXT("_SpriteForge"),Error);if(!Asset)return nullptr;
    Asset->Modify();Asset->SchemaVersion=1;Asset->SourceAsset=Doc.Asset;Asset->SourceMetadataFile=MetadataPath;Asset->Atlas=Texture;Asset->Material=Instance;Asset->AtlasSize=Doc.AtlasSize;Asset->CellSize=Doc.CellSize;Asset->Pivot=Doc.Pivot;Asset->AnchorType=Doc.AnchorType;Asset->Directions=Doc.Directions;Asset->FrontDirection=Doc.FrontDirection;Asset->Frames=Doc.Frames;Asset->Animations=Doc.Animations;Asset->RecipeJSON=Doc.RecipeJSON;Asset->bTransparent=Doc.bTransparent;Asset->PostEditChange();
    return SaveAsset(Asset,Error)?Asset:nullptr;
}
