#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "SpriteForgeCharacterAsset.generated.h"
class USpriteForgeAsset;
USTRUCT(BlueprintType)
struct SPRITEFORGERUNTIME_API FSpriteForgeCharacterState {
    GENERATED_BODY()
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TObjectPtr<USpriteForgeAsset> Sprite;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FName Clip;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float FPS = 12;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float Duration = 1;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") bool bLoop = true;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") bool bReturnToDefault = true;
};
UCLASS(BlueprintType)
class SPRITEFORGERUNTIME_API USpriteForgeCharacterAsset : public UDataAsset {
    GENERATED_BODY()
public:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") int32 SchemaVersion = 1;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FString CharacterName;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FName DefaultState;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TArray<float> Directions;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") float FrontDirection = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FVector2D Anchor;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") FString CoordinateSystem;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TMap<FName, FSpriteForgeCharacterState> States;
};
