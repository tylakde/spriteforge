#pragma once
#include "CoreMinimal.h"
class USpriteForgeAsset;
namespace SpriteForgeImportService {
    SPRITEFORGEEDITOR_API USpriteForgeAsset* Import(const FString& MetadataPath,const FString& AtlasOverride,FString& Error);
}
