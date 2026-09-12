#pragma once
#include "CoreMinimal.h"
#include "SpriteForgeImpostorActor.h"
#include "SpriteForgeCharacterExample.generated.h"
class UCameraComponent;
// Ready-to-drop visual demo; movement intentionally has no combat or collision rules.
UCLASS(Blueprintable)
class SPRITEFORGERUNTIME_API ASpriteForgeCharacterExample : public ASpriteForgeImpostorActor {
    GENERATED_BODY()
public:
    ASpriteForgeCharacterExample();
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge|Demo") bool bDemoControls = true;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge|Demo") float WalkSpeed = 180;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SpriteForge|Demo") float RunSpeed = 360;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="SpriteForge|Demo") TObjectPtr<UCameraComponent> DemoCamera;
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
};
