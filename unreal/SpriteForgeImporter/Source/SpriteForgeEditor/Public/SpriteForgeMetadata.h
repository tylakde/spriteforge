#pragma once
#include "CoreMinimal.h"
#include "SpriteForgeAsset.h"
struct FSpriteForgeDocument {
    FString Asset, AtlasFile, AnchorType, RecipeJSON;
    FIntPoint AtlasSize,CellSize;
    FVector2D Pivot;
    float FrontDirection=0;
    bool bTransparent=true;
    bool bPixelated=false;
    TArray<float> Directions;
    TArray<FSpriteForgeFrame> Frames;
    TMap<FName,FSpriteForgeAnimation> Animations;
};
namespace SpriteForgeMetadata {
    SPRITEFORGEEDITOR_API bool Parse(const FString& JSON,FSpriteForgeDocument& Out,FString& Error);
}
