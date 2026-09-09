#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "SpriteForgeAsset.generated.h"
class UTexture2D;
class UMaterialInterface;
USTRUCT(BlueprintType)
struct SPRITEFORGERUNTIME_API FSpriteForgeFrame {
    GENERATED_BODY()
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") int32 Index = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float DirectionDegrees = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FName Animation;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") int32 AnimationFrame = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float Time = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float Duration = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FIntPoint PixelOrigin;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FIntPoint PixelSize;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FVector2D UVOrigin;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FVector2D UVSize;
};
USTRUCT(BlueprintType)
struct SPRITEFORGERUNTIME_API FSpriteForgeAnimation {
    GENERATED_BODY()
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float FPS = 12;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") int32 FrameCount = 1;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float Duration = 0;
};
UCLASS(BlueprintType)
class SPRITEFORGERUNTIME_API USpriteForgeAsset : public UDataAsset {
    GENERATED_BODY()
public:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") int32 SchemaVersion = 1;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FString SourceAsset;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FString SourceMetadataFile;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TObjectPtr<UTexture2D> Atlas;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TObjectPtr<UMaterialInterface> Material;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FIntPoint AtlasSize;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FIntPoint CellSize;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FVector2D Pivot = FVector2D(0.5,0.9);
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FString AnchorType;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TArray<float> Directions;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float FrontDirection = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TArray<FSpriteForgeFrame> Frames;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TMap<FName,FSpriteForgeAnimation> Animations;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FString RecipeJSON;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") bool bTransparent = true;
    UFUNCTION(BlueprintPure, Category="SpriteForge") int32 FindFrame(float RelativeCameraYaw, FName AnimationName, float TimeSeconds) const;
};
