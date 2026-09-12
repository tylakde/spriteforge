#include "SpriteForgeImportService.h"
#include "SpriteForgeMetadata.h"
#include "SpriteForgeAsset.h"
#include "SpriteForgeCharacterAsset.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
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
USpriteForgeAsset* SpriteForgeImportService::Import(const FString& MetadataPath,const FString& AtlasOverride,FString& Error,const FString& Destination) {
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
    const FString Folder=Destination.IsEmpty()?TEXT("/Game/SpriteForge/")+Doc.Asset:Destination,TextureName=TEXT("T_")+Doc.Asset+TEXT("_Atlas");
    if(UObject* Existing=LoadObject<UObject>(nullptr,*(Folder/TextureName+TEXT(".")+TextureName));Existing&&!Existing->IsA<UTexture2D>()){Error=TEXT("An unrelated asset occupies the atlas destination.");return nullptr;}
    UAssetImportTask* Task=NewObject<UAssetImportTask>();Task->Filename=AtlasPath;Task->DestinationPath=Folder;Task->DestinationName=TextureName;Task->bAutomated=true;Task->bReplaceExisting=true;Task->bSave=false;Task->Factory=NewObject<UTextureFactory>();
    FModuleManager::LoadModuleChecked<FAssetToolsModule>(TEXT("AssetTools")).Get().ImportAssetTasks({Task});
    UTexture2D* Texture=nullptr;for(UObject* Object:Task->GetObjects())if((Texture=Cast<UTexture2D>(Object)))break;
    if(!Texture){Error=TEXT("Unreal could not import the atlas texture.");return nullptr;}
    Texture->SRGB=true;Texture->CompressionSettings=TC_EditorIcon;Texture->MipGenSettings=TMGS_NoMipmaps;Texture->AddressX=TA_Clamp;Texture->AddressY=TA_Clamp;Texture->Filter=Doc.bPixelated?TF_Nearest:TF_Bilinear;Texture->LODGroup=TEXTUREGROUP_Pixels2D;Texture->NeverStream=true;Texture->PostEditChange();
    if(!SaveAsset(Texture,Error))return nullptr;
    UMaterial* Material=MakeMaterial(Texture,Error);if(!Material)return nullptr;
    UMaterialInstanceConstant* Instance=AssetAt<UMaterialInstanceConstant>(Folder,TEXT("MI_")+Doc.Asset+TEXT("_Impostor"),Error);if(!Instance)return nullptr;
    Instance->SetParentEditorOnly(Material);Instance->SetTextureParameterValueEditorOnly(TEXT("Atlas"),Texture);
    const auto& First=Doc.Frames[0];Instance->SetVectorParameterValueEditorOnly(TEXT("UVScale"),FLinearColor(First.UVSize.X,First.UVSize.Y,0,0));Instance->SetVectorParameterValueEditorOnly(TEXT("UVOffset"),FLinearColor(First.UVOrigin.X,First.UVOrigin.Y,0,0));Instance->PostEditChange();if(!SaveAsset(Instance,Error))return nullptr;
    USpriteForgeAsset* Asset=AssetAt<USpriteForgeAsset>(Folder,TEXT("DA_")+Doc.Asset+TEXT("_SpriteForge"),Error);if(!Asset)return nullptr;
    Asset->Modify();Asset->SchemaVersion=1;Asset->SourceAsset=Doc.Asset;Asset->SourceMetadataFile=MetadataPath;Asset->Atlas=Texture;Asset->Material=Instance;Asset->AtlasSize=Doc.AtlasSize;Asset->CellSize=Doc.CellSize;Asset->Pivot=Doc.Pivot;Asset->AnchorType=Doc.AnchorType;Asset->Directions=Doc.Directions;Asset->FrontDirection=Doc.FrontDirection;Asset->Frames=Doc.Frames;Asset->Animations=Doc.Animations;Asset->RecipeJSON=Doc.RecipeJSON;Asset->bTransparent=Doc.bTransparent;Asset->PostEditChange();
    return SaveAsset(Asset,Error)?Asset:nullptr;
}

USpriteForgeCharacterAsset* SpriteForgeImportService::ImportCharacter(const FString& MetadataPath,FString& Error) {
    auto Fail=[&Error](const TCHAR* Message)->USpriteForgeCharacterAsset* { Error=Message;return nullptr; };
    FString JSON;TSharedPtr<FJsonObject> Root;
    if(!FFileHelper::LoadFileToString(JSON,*MetadataPath)||!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(JSON),Root)||!Root.IsValid()) return Fail(TEXT("Invalid character JSON."));
    FString Format,Name,Default,Coordinates;double Version;
    if(!Root->TryGetStringField(TEXT("format"),Format)||Format!=TEXT("spriteforge-character")||!Root->TryGetNumberField(TEXT("version"),Version)||Version!=1||!Root->TryGetStringField(TEXT("name"),Name)||Name.IsEmpty()||Name.Len()>80||!Root->TryGetStringField(TEXT("defaultState"),Default)||!Root->TryGetStringField(TEXT("coordinateSystem"),Coordinates)) return Fail(TEXT("Invalid character schema."));
    for(TCHAR C:Name) if(!FChar::IsAlnum(C)&&C!=TEXT('_')&&C!=TEXT('-')) return Fail(TEXT("Unsafe character name."));
    const TArray<TSharedPtr<FJsonValue>>* States=nullptr;
    if(!Root->TryGetArrayField(TEXT("states"),States)||States->IsEmpty()||States->Num()>256) return Fail(TEXT("Character must contain 1–256 states."));
    struct Pending { FName Name;FString Path;FString Folder;FSpriteForgeDocument Doc;FSpriteForgeCharacterState State; };
    TArray<Pending> Items;TSet<FName> Names;TSet<FString> Paths;
    auto SafeRelative=[](const FString& Path) { TArray<FString> Segments;Path.ParseIntoArray(Segments,TEXT("/"),false);if(Segments.Num()!=2)return false;for(const auto& S:Segments)if(S.IsEmpty()||S==TEXT("..")||S==TEXT("."))return false;return !Path.Contains(TEXT("\\"))&&!Path.Contains(TEXT(":")); };
    // Preflight all state metadata and PNG headers before creating or replacing any assets.
    for(const auto& Value:*States) {
        const TSharedPtr<FJsonObject>* State=nullptr; if(!Value->TryGetObject(State))return Fail(TEXT("Invalid character state."));
        Pending Item;FString StateName,Relative,Atlas,Clip;double FPS,Duration,Count;
        if(!(*State)->TryGetStringField(TEXT("name"),StateName)||StateName.IsEmpty()||StateName.Len()>64||!FChar::IsAlpha(StateName[0]))return Fail(TEXT("Invalid state name."));
        for(TCHAR C:StateName)if(!FChar::IsAlnum(C)&&C!=TEXT('_')&&C!=TEXT('-')&&C!=TEXT(' '))return Fail(TEXT("Unsafe state name."));
        Item.Name=FName(*StateName);if(Names.Contains(Item.Name))return Fail(TEXT("Duplicate character state."));Names.Add(Item.Name);
        if(!(*State)->TryGetStringField(TEXT("metadata"),Relative)||!SafeRelative(Relative)||!Relative.EndsWith(TEXT(".json"))||!(*State)->TryGetStringField(TEXT("atlas"),Atlas)||!SafeRelative(Atlas)||!(*State)->TryGetStringField(TEXT("clip"),Clip)||!(*State)->TryGetNumberField(TEXT("fps"),FPS)||!(*State)->TryGetNumberField(TEXT("duration"),Duration)||!(*State)->TryGetNumberField(TEXT("frameCount"),Count)||!(*State)->TryGetBoolField(TEXT("loop"),Item.State.bLoop)||!(*State)->TryGetBoolField(TEXT("returnToDefault"),Item.State.bReturnToDefault))return Fail(TEXT("Invalid character state references or playback."));
        Item.Folder=FPaths::GetPath(Relative);for(TCHAR C:Item.Folder)if(!FChar::IsAlnum(C)&&C!=TEXT('_')&&C!=TEXT('-'))return Fail(TEXT("Unsafe state folder."));
        if(Paths.Contains(Item.Folder.ToLower()))return Fail(TEXT("Duplicate state destination."));Paths.Add(Item.Folder.ToLower());
        Item.Path=FPaths::Combine(FPaths::GetPath(MetadataPath),Relative);FString StateJSON;
        if(!FFileHelper::LoadFileToString(StateJSON,*Item.Path)||!SpriteForgeMetadata::Parse(StateJSON,Item.Doc,Error))return nullptr;
        const auto* Animation=Item.Doc.Animations.Find(FName(*Clip));
        if(!Animation||!FMath::IsFinite(FPS)||!FMath::IsFinite(Duration)||Animation->FPS!=FPS||!FMath::IsNearlyEqual(double(Animation->Duration),Duration,0.00001)||Animation->FrameCount!=Count||Item.Doc.Animations.Num()!=1)return Fail(TEXT("State playback does not match sprite metadata."));
        if(Atlas!=FPaths::Combine(Item.Folder,Item.Doc.AtlasFile))return Fail(TEXT("State atlas path does not match sprite metadata."));
        if(!Items.IsEmpty()) {const auto& First=Items[0].Doc;if(Item.Doc.Directions!=First.Directions||Item.Doc.Pivot!=First.Pivot||Item.Doc.FrontDirection!=First.FrontDirection||Item.Doc.CellSize!=First.CellSize||Item.Doc.AnchorType!=First.AnchorType)return Fail(TEXT("Character states have inconsistent directions, anchors or resolution."));}
        TArray<uint8> PNG;const FString PNGPath=FPaths::Combine(FPaths::GetPath(MetadataPath),Atlas);
        const uint8 Signature[]={137,80,78,71,13,10,26,10};
        if(!FFileHelper::LoadFileToArray(PNG,*PNGPath)||PNG.Num()<24||FMemory::Memcmp(PNG.GetData(),Signature,8)!=0)return Fail(TEXT("Missing or invalid character atlas PNG."));
        auto BE=[&PNG](int32 I)->uint32 {return uint32(PNG[I])<<24|uint32(PNG[I+1])<<16|uint32(PNG[I+2])<<8|PNG[I+3];};
        if(BE(16)!=uint32(Item.Doc.AtlasSize.X)||BE(20)!=uint32(Item.Doc.AtlasSize.Y))return Fail(TEXT("Character atlas dimensions do not match metadata."));
        Item.State.Clip=FName(*Clip);Item.State.FPS=FPS;Item.State.Duration=Duration;Items.Add(MoveTemp(Item));
    }
    if(!Names.Contains(FName(*Default)))return Fail(TEXT("Default state is missing."));
    const auto& First=Items[0].Doc;
    const TArray<TSharedPtr<FJsonValue>>* Directions=nullptr;const TSharedPtr<FJsonObject>* Anchor=nullptr;double X,Y,Front;
    if(!Root->TryGetArrayField(TEXT("directions"),Directions)||Directions->Num()!=First.Directions.Num()||!Root->TryGetObjectField(TEXT("anchor"),Anchor)||!(*Anchor)->TryGetNumberField(TEXT("x"),X)||!(*Anchor)->TryGetNumberField(TEXT("y"),Y)||!Root->TryGetNumberField(TEXT("frontDirection"),Front)||!FMath::IsFinite(X)||!FMath::IsFinite(Y)||!FMath::IsFinite(Front)||!FVector2D(X,Y).Equals(First.Pivot,0.00001)||!FMath::IsNearlyEqual(Front,double(First.FrontDirection),0.0001))return Fail(TEXT("Character anchor or direction convention is inconsistent."));
    for(int32 I=0;I<Directions->Num();I++){double Angle;if(!(*Directions)[I]->TryGetNumber(Angle)||!FMath::IsFinite(Angle)||!FMath::IsNearlyEqual(Angle,double(First.Directions[I]),0.001))return Fail(TEXT("Character direction list is inconsistent."));}
    const FString Folder=TEXT("/Game/SpriteForge/Characters/")+Name;
    USpriteForgeCharacterAsset* Character=AssetAt<USpriteForgeCharacterAsset>(Folder,TEXT("DA_")+Name+TEXT("_Character"),Error);if(!Character)return nullptr;
    TMap<FName,FSpriteForgeCharacterState> Imported;
    for(auto& Item:Items) {Item.State.Sprite=Import(Item.Path,TEXT(""),Error,Folder/Item.Folder);if(!Item.State.Sprite)return nullptr;Imported.Add(Item.Name,Item.State);}
    Character->Modify();Character->CharacterName=Name;Character->DefaultState=FName(*Default);Character->Directions=First.Directions;Character->FrontDirection=First.FrontDirection;Character->Anchor=First.Pivot;Character->CoordinateSystem=Coordinates;Character->States=MoveTemp(Imported);Character->PostEditChange();
    return SaveAsset(Character,Error)?Character:nullptr;
}
