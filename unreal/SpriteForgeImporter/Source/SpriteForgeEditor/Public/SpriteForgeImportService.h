#pragma once
#include "CoreMinimal.h"
class USpriteForgeAsset;
class USpriteForgeCharacterAsset;
namespace SpriteForgeImportService {
    SPRITEFORGEEDITOR_API USpriteForgeAsset* Import(const FString& MetadataPath,const FString& AtlasOverride,FString& Error, const FString& Destination = TEXT(""));
    SPRITEFORGEEDITOR_API USpriteForgeCharacterAsset* ImportCharacter(const FString& MetadataPath, FString& Error);
}
