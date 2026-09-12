#include "SpriteForgeImpostorActor.h"
#include "SpriteForgeAsset.h"
#include "SpriteForgeCharacterAsset.h"
#include "ProceduralMeshComponent.h"
#include "Components/SceneComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/Texture2D.h"
#include "Kismet/GameplayStatics.h"
#include "Camera/PlayerCameraManager.h"
ASpriteForgeImpostorActor::ASpriteForgeImpostorActor() {
    PrimaryActorTick.bCanEverTick=true;
    SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));
    Quad=CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("ImpostorQuad"));
    Quad->SetupAttachment(RootComponent);
    Quad->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Quad->SetCastShadow(false);
}
void ASpriteForgeImpostorActor::OnConstruction(const FTransform& Transform) {Super::OnConstruction(Transform);Rebuild();}
void ASpriteForgeImpostorActor::BeginPlay() {Super::BeginPlay();Rebuild();}
void ASpriteForgeImpostorActor::Rebuild() {
    if (CharacterAsset) {
        if (!CharacterAsset->States.Contains(CurrentState)) CurrentState=CharacterAsset->DefaultState;
        if (const auto* State=CharacterAsset->States.Find(CurrentState)) { SpriteAsset=State->Sprite; AnimationName=State->Clip; }
    }
    Quad->ClearAllMeshSections();DynamicMaterial=nullptr;CurrentFrame=INDEX_NONE;
    if (!SpriteAsset || !SpriteAsset->Material || !SpriteAsset->Atlas || SpriteAsset->CellSize.Y<=0) return;
    const float Height=FMath::Max(1.f,CellHeightCm),Width=Height*SpriteAsset->CellSize.X/SpriteAsset->CellSize.Y;
    const float Left=Width*SpriteAsset->Pivot.X,Right=-Width*(1-SpriteAsset->Pivot.X);
    const float Bottom=-Height*(1-SpriteAsset->Pivot.Y),Top=Height*SpriteAsset->Pivot.Y;
    TArray<FVector> Vertices={FVector(0,Left,Bottom),FVector(0,Right,Bottom),FVector(0,Left,Top),FVector(0,Right,Top)};
    TArray<int32> Triangles={0,2,1,1,2,3};
    TArray<FVector> Normals={FVector::ForwardVector,FVector::ForwardVector,FVector::ForwardVector,FVector::ForwardVector};
    TArray<FVector2D> UVs={FVector2D(0,1),FVector2D(1,1),FVector2D(0,0),FVector2D(1,0)};
    TArray<FLinearColor> Colors;TArray<FProcMeshTangent> Tangents;
    Quad->CreateMeshSection_LinearColor(0,Vertices,Triangles,Normals,UVs,Colors,Tangents,false);
    DynamicMaterial=UMaterialInstanceDynamic::Create(SpriteAsset->Material,this);
    DynamicMaterial->SetTextureParameterValue(TEXT("Atlas"),SpriteAsset->Atlas);
    Quad->SetMaterial(0,DynamicMaterial);
    if (AnimationName.IsNone() && !SpriteAsset->Animations.IsEmpty()) {for(const auto& Pair:SpriteAsset->Animations){AnimationName=Pair.Key;break;}}
    UpdateForCamera(GetActorLocation()+GetActorForwardVector()*1000);
}
void ASpriteForgeImpostorActor::SetAnimation(FName Name,bool bRestart) {AnimationName=Name;if(bRestart)Elapsed=0;CurrentFrame=INDEX_NONE;}
void ASpriteForgeImpostorActor::Tick(float DeltaSeconds) {
    Super::Tick(DeltaSeconds);
    AdvancePlayback(DeltaSeconds);
    if(APlayerCameraManager* Camera=UGameplayStatics::GetPlayerCameraManager(this,PlayerIndex))UpdateForCamera(Camera->GetCameraLocation());
}
void ASpriteForgeImpostorActor::AdvancePlayback(float DeltaSeconds) {
    if(bPlaying)Elapsed+=FMath::Max(DeltaSeconds,0.f)*FMath::Max(PlayRate,0.f);
    if(CharacterAsset) if(const auto* State=CharacterAsset->States.Find(CurrentState)) {
        if(Elapsed>=State->Duration && !State->bLoop) {
            if(State->bReturnToDefault && CurrentState!=CharacterAsset->DefaultState) SetState(CharacterAsset->DefaultState,true);
            else Elapsed=FMath::Max(0.f,State->Duration-0.00001f);
        }
    }
}
void ASpriteForgeImpostorActor::UpdateForCamera(FVector CameraLocation) {
    if(!SpriteAsset || !DynamicMaterial)return;
    FVector ToCamera=CameraLocation-GetActorLocation();ToCamera.Z=0;if(ToCamera.IsNearlyZero())return;
    const float CameraYaw=ToCamera.Rotation().Yaw;
    // Source +Z (front) -> Unreal +X; source +X -> Unreal +Y. Positive yaw is preserved.
    const int32 Index=SpriteAsset->FindFrame(CameraYaw-GetActorRotation().Yaw,AnimationName,Elapsed);
    Quad->SetWorldRotation(FRotator(0,CameraYaw,0)); // Root heading is not changed by billboarding.
    if(!SpriteAsset->Frames.IsValidIndex(Index) || Index==CurrentFrame)return;
    CurrentFrame=Index;const FSpriteForgeFrame& Frame=SpriteAsset->Frames[Index];
    // Half-texel inset prevents sampling neighbouring cells with bilinear filtering.
    const FVector2D Inset(0.5/SpriteAsset->AtlasSize.X,0.5/SpriteAsset->AtlasSize.Y);
    const FVector2D Scale=Frame.UVSize-2*Inset,Offset=Frame.UVOrigin+Inset;
    DynamicMaterial->SetVectorParameterValue(TEXT("UVScale"),FLinearColor(Scale.X,Scale.Y,0,0));
    DynamicMaterial->SetVectorParameterValue(TEXT("UVOffset"),FLinearColor(Offset.X,Offset.Y,0,0));
}

bool ASpriteForgeImpostorActor::SetState(FName Name, bool bRestart) {
    if(!CharacterAsset) return false;
    const auto* State=CharacterAsset->States.Find(Name); if(!State || !State->Sprite) return false;
    if(CurrentState==Name && !bRestart) return true;
    CurrentState=Name; SpriteAsset=State->Sprite; AnimationName=State->Clip; Elapsed=0; Rebuild(); return true;
}
bool ASpriteForgeImpostorActor::PlayOneShot(FName Name) {
    if(!CharacterAsset) return false;
    const auto* State=CharacterAsset->States.Find(Name); if(!State || State->bLoop) return false;
    return SetState(Name,true);
}
bool ASpriteForgeImpostorActor::IsOneShotActive() const {
    if(!CharacterAsset) return false;
    const auto* State=CharacterAsset->States.Find(CurrentState);
    return State && !State->bLoop;
}
