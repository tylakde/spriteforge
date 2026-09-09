#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SpriteForgeImpostorActor.generated.h"
class USpriteForgeAsset;
class UProceduralMeshComponent;
class UMaterialInstanceDynamic;
UCLASS(Blueprintable)
class SPRITEFORGERUNTIME_API ASpriteForgeImpostorActor : public AActor {
    GENERATED_BODY()
public:
    ASpriteForgeImpostorActor();
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge") TObjectPtr<USpriteForgeAsset> SpriteAsset;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge", meta=(ClampMin="1")) float CellHeightCm = 250;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge") FName AnimationName;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge") bool bPlaying = true;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge", meta=(ClampMin="0")) float PlayRate = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge") int32 PlayerIndex = 0;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge") TObjectPtr<UProceduralMeshComponent> Quad;
    UPROPERTY(Transient, BlueprintReadOnly, Category="SpriteForge") int32 CurrentFrame = INDEX_NONE;
    UFUNCTION(BlueprintCallable, Category="SpriteForge") void Rebuild();
    UFUNCTION(BlueprintCallable, Category="SpriteForge") void SetAnimation(FName Name, bool bRestart=true);
    UFUNCTION(BlueprintCallable, Category="SpriteForge") void UpdateForCamera(FVector CameraLocation);
    virtual void OnConstruction(const FTransform& Transform) override;
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
private:
    UPROPERTY(Transient) TObjectPtr<UMaterialInstanceDynamic> DynamicMaterial;
    float Elapsed = 0;
};
