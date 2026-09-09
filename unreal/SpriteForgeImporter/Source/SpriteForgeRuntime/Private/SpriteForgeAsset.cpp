#include "SpriteForgeAsset.h"
#include "Modules/ModuleManager.h"
IMPLEMENT_MODULE(FDefaultModuleImpl, SpriteForgeRuntime)
int32 USpriteForgeAsset::FindFrame(float RelativeCameraYaw, FName AnimationName, float TimeSeconds) const {
    if (Frames.IsEmpty() || Directions.IsEmpty()) return INDEX_NONE;
    const float TargetAngle = FRotator::ClampAxis(RelativeCameraYaw + FrontDirection);
    float Direction = Directions[0], Best = TNumericLimits<float>::Max();
    for (float Candidate : Directions) {
        const float Delta = FMath::Abs(FMath::FindDeltaAngleDegrees(TargetAngle,Candidate));
        if (Delta < Best) { Best=Delta; Direction=Candidate; }
    }
    int32 AnimationFrame=0;
    if (const FSpriteForgeAnimation* Clip=Animations.Find(AnimationName)) {
        if (Clip->Duration>0 && Clip->FrameCount>0) AnimationFrame=FMath::Clamp(FMath::FloorToInt(FMath::Fmod(FMath::Max(TimeSeconds,0.f),Clip->Duration)*Clip->FPS),0,Clip->FrameCount-1);
    }
    int32 Fallback=INDEX_NONE;
    for (int32 i=0;i<Frames.Num();++i) {
        const FSpriteForgeFrame& Frame=Frames[i];
        if (!FMath::IsNearlyZero(FMath::FindDeltaAngleDegrees(Direction,Frame.DirectionDegrees),0.01f)) continue;
        if (Fallback==INDEX_NONE) Fallback=i;
        if (Frame.Animation==AnimationName && Frame.AnimationFrame==AnimationFrame) return i;
    }
    return Fallback;
}
