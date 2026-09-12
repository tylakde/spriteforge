#include "SpriteForgeCharacterExample.h"
#include "SpriteForgeCharacterAsset.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "InputCoreTypes.h"
ASpriteForgeCharacterExample::ASpriteForgeCharacterExample() {
    DemoCamera=CreateDefaultSubobject<UCameraComponent>(TEXT("DemoCamera"));
    DemoCamera->SetupAttachment(RootComponent); DemoCamera->SetUsingAbsoluteRotation(true);
    DemoCamera->SetRelativeLocation(FVector(-700,0,650)); DemoCamera->SetWorldRotation(FRotator(-42,0,0));
}
void ASpriteForgeCharacterExample::BeginPlay() {
    Super::BeginPlay();
    if(bDemoControls) if(auto* PC=UGameplayStatics::GetPlayerController(this,PlayerIndex)) PC->SetViewTarget(this);
}
void ASpriteForgeCharacterExample::Tick(float DeltaSeconds) {
    if(bDemoControls && CharacterAsset) if(auto* PC=UGameplayStatics::GetPlayerController(this,PlayerIndex)) {
        if(PC->WasInputKeyJustPressed(EKeys::LeftMouseButton)) PlayOneShot(TEXT("Attack"));
        if(PC->WasInputKeyJustPressed(EKeys::SpaceBar)) PlayOneShot(CharacterAsset->States.Contains(TEXT("Dodge"))?TEXT("Dodge"):TEXT("Jump"));
        if(PC->WasInputKeyJustPressed(EKeys::Q)) PlayOneShot(CharacterAsset->States.Contains(TEXT("Ability 1"))?TEXT("Ability 1"):TEXT("Cast"));
        if(PC->WasInputKeyJustPressed(EKeys::E)) PlayOneShot(TEXT("Ability 2"));
        if(!IsOneShotActive()) {
            FVector Move(float(PC->IsInputKeyDown(EKeys::W))-float(PC->IsInputKeyDown(EKeys::S)),float(PC->IsInputKeyDown(EKeys::D))-float(PC->IsInputKeyDown(EKeys::A)),0);
            bool Running=PC->IsInputKeyDown(EKeys::LeftShift);
            FName State=Move.IsNearlyZero()?CharacterAsset->DefaultState:FName(Running?TEXT("Run"):TEXT("Walk"));
            if(!CharacterAsset->States.Contains(State)) State=CharacterAsset->States.Contains(TEXT("Walk"))?FName(TEXT("Walk")):CharacterAsset->DefaultState;
            SetState(State);
            if(!Move.IsNearlyZero()) { Move.Normalize(); AddActorWorldOffset(Move*(Running?RunSpeed:WalkSpeed)*DeltaSeconds); SetActorRotation(Move.Rotation()); }
        }
        DemoCamera->SetWorldLocation(GetActorLocation()+FVector(-700,0,650));
    }
    Super::Tick(DeltaSeconds);
}
