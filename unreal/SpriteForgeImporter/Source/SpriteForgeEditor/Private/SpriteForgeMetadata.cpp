#include "SpriteForgeMetadata.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
namespace {
using Object=TSharedPtr<FJsonObject>;
bool Number(const Object& Obj,const TCHAR* Key,double& Out,double Min,double Max) {return Obj.IsValid() && Obj->TryGetNumberField(Key,Out) && FMath::IsFinite(Out) && Out>=Min && Out<=Max;}
bool Integer(const Object& Obj,const TCHAR* Key,int32& Out,int32 Min,int32 Max) {double N;if(!Number(Obj,Key,N,Min,Max) || N!=FMath::FloorToDouble(N))return false;Out=static_cast<int32>(N);return true;}
Object Child(const Object& Obj,const TCHAR* Key) {const Object* Value=nullptr;return Obj.IsValid() && Obj->TryGetObjectField(Key,Value)?*Value:nullptr;}
}
bool SpriteForgeMetadata::Parse(const FString& JSON,FSpriteForgeDocument& Out,FString& Error) {
    Out=FSpriteForgeDocument();
    auto Fail=[&Error](const TCHAR* Message){Error=Message;return false;};
    Object Root;if(!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(JSON),Root)||!Root.IsValid())return Fail(TEXT("Invalid JSON document."));
    int32 Version=0;if(!Integer(Root,TEXT("version"),Version,1,1))return Fail(TEXT("Only SpriteForge schema version 1 is supported."));
    if(!Root->TryGetStringField(TEXT("asset"),Out.Asset)||Out.Asset.IsEmpty()||Out.Asset.Len()>80)return Fail(TEXT("Missing or invalid asset name."));
    for(TCHAR C:Out.Asset)if(!FChar::IsAlnum(C)&&C!=TEXT('_')&&C!=TEXT('-'))return Fail(TEXT("Unsafe asset name."));
    const Object Atlas=Child(Root,TEXT("atlas"));
    if(!Atlas.IsValid()||!Atlas->TryGetStringField(TEXT("file"),Out.AtlasFile)||!Out.AtlasFile.EndsWith(TEXT(".png"))||Out.AtlasFile.Contains(TEXT("/"))||Out.AtlasFile.Contains(TEXT("\\"))||Out.AtlasFile.Contains(TEXT(":")))return Fail(TEXT("Atlas must be a relative PNG filename."));
    if(!Integer(Atlas,TEXT("width"),Out.AtlasSize.X,1,8192)||!Integer(Atlas,TEXT("height"),Out.AtlasSize.Y,1,8192)||!Integer(Atlas,TEXT("cellWidth"),Out.CellSize.X,1,1024)||!Integer(Atlas,TEXT("cellHeight"),Out.CellSize.Y,1,1024))return Fail(TEXT("Invalid atlas or cell dimensions."));
    if(static_cast<int64>(Out.AtlasSize.X)*Out.AtlasSize.Y>33554432)return Fail(TEXT("Atlas exceeds the 32 megapixel limit."));
    const Object Anchor=Child(Root,TEXT("anchor"));double X,Y,Front;
    if(!Anchor.IsValid()||!Anchor->TryGetStringField(TEXT("type"),Out.AnchorType)||(Out.AnchorType!=TEXT("ground")&&Out.AnchorType!=TEXT("center"))||!Number(Anchor,TEXT("x"),X,0,1)||!Number(Anchor,TEXT("y"),Y,0,1)||!Number(Root,TEXT("frontDirection"),Front,0,360))return Fail(TEXT("Invalid pivot or front direction."));
    Out.Pivot=FVector2D(X,Y);Out.FrontDirection=Front;
    FString Background,Ordering;
    if(!Root->TryGetStringField(TEXT("background"),Background)||(Background!=TEXT("transparent")&&Background!=TEXT("solid"))||!Root->TryGetStringField(TEXT("frameOrdering"),Ordering)||Ordering!=TEXT("direction-major"))return Fail(TEXT("Invalid background or frame ordering."));
    Out.bTransparent=Background==TEXT("transparent");
    const TArray<TSharedPtr<FJsonValue>>* Directions=nullptr;int32 DirectionCount;
    if(!Integer(Root,TEXT("directionCount"),DirectionCount,1,32)||!Root->TryGetArrayField(TEXT("directions"),Directions)||Directions->Num()!=DirectionCount||!(DirectionCount==1||DirectionCount==4||DirectionCount==8||DirectionCount==16||DirectionCount==32))return Fail(TEXT("Invalid direction count."));
    for(const auto& Value:*Directions){double Angle;if(!Value->TryGetNumber(Angle)||!FMath::IsFinite(Angle)||Angle<0||Angle>=360)return Fail(TEXT("Invalid direction angle."));for(float Existing:Out.Directions)if(FMath::Abs(FMath::FindDeltaAngleDegrees(Existing,Angle))<0.001)return Fail(TEXT("Duplicate directions."));Out.Directions.Add(Angle);}
    if(Root->HasField(TEXT("appearance"))){
        const Object Appearance=Child(Root,TEXT("appearance"));FString Filter;int32 AppearanceVersion,PixelScale;
        if(!Appearance.IsValid()||!Integer(Appearance,TEXT("version"),AppearanceVersion,1,1)||!Integer(Appearance,TEXT("pixelScale"),PixelScale,1,8)||!Appearance->TryGetStringField(TEXT("textureFilter"),Filter)||(Filter!=TEXT("nearest")&&Filter!=TEXT("linear")))return Fail(TEXT("Invalid appearance/filter metadata."));
        Out.bPixelated=Filter==TEXT("nearest");
    }
    const Object Animations=Child(Root,TEXT("animations"));if(!Animations.IsValid())return Fail(TEXT("Missing animation dictionary."));
    for(const auto& Pair:Animations->Values){const Object* A=nullptr;double FPS,Duration;FSpriteForgeAnimation Clip;
        if(Pair.Key.IsEmpty()||!Pair.Value->TryGetObject(A)||!Number(*A,TEXT("fps"),FPS,1,60)||!Number(*A,TEXT("duration"),Duration,0.00001,4096)||!Integer(*A,TEXT("frameCount"),Clip.FrameCount,1,4096))return Fail(TEXT("Invalid animation definition."));
        Clip.FPS=FPS;Clip.Duration=Duration;Out.Animations.Add(FName(*Pair.Key),Clip);
    }
    const Object Recipe=Child(Root,TEXT("recipe"));if(!Recipe.IsValid())return Fail(TEXT("Missing recipe snapshot."));FJsonSerializer::Serialize(Recipe.ToSharedRef(),TJsonWriterFactory<>::Create(&Out.RecipeJSON));
    const TArray<TSharedPtr<FJsonValue>>* Frames=nullptr;if(!Root->TryGetArrayField(TEXT("frames"),Frames)||Frames->IsEmpty()||Frames->Num()>8192)return Fail(TEXT("Missing or excessive frame records."));
    TSet<FString> Keys;
    for(const auto& Value:*Frames){const Object* Ptr=nullptr;if(!Value->TryGetObject(Ptr))return Fail(TEXT("Invalid frame record."));const Object F=*Ptr,R=Child(F,TEXT("rect"));FSpriteForgeFrame Frame;double Angle,Time,Duration;FString Animation;
        if(!Integer(F,TEXT("index"),Frame.Index,0,Frames->Num()-1)||Frame.Index!=Out.Frames.Num()||!Integer(F,TEXT("animationFrame"),Frame.AnimationFrame,0,4095)||!Number(F,TEXT("directionDegrees"),Angle,0,359.99999)||!Number(F,TEXT("time"),Time,0,4096)||!Number(F,TEXT("duration"),Duration,0,4096)||!F->TryGetStringField(TEXT("animation"),Animation))return Fail(TEXT("Invalid frame index, direction or timing."));
        if(!Integer(R,TEXT("x"),Frame.PixelOrigin.X,0,Out.AtlasSize.X)||!Integer(R,TEXT("y"),Frame.PixelOrigin.Y,0,Out.AtlasSize.Y)||!Integer(R,TEXT("width"),Frame.PixelSize.X,1,Out.CellSize.X)||!Integer(R,TEXT("height"),Frame.PixelSize.Y,1,Out.CellSize.Y)||Frame.PixelSize!=Out.CellSize||Frame.PixelOrigin.X+Frame.PixelSize.X>Out.AtlasSize.X||Frame.PixelOrigin.Y+Frame.PixelSize.Y>Out.AtlasSize.Y)return Fail(TEXT("Frame rectangle is outside its atlas."));
        bool Known=false;for(float D:Out.Directions)Known|=FMath::IsNearlyEqual(D,static_cast<float>(Angle),0.001f);if(!Known)return Fail(TEXT("Frame uses an undeclared direction."));
        Frame.DirectionDegrees=Angle;Frame.Animation=FName(*Animation);Frame.Time=Time;Frame.Duration=Duration;
        if(!Animation.IsEmpty()){const auto* Clip=Out.Animations.Find(Frame.Animation);if(!Clip||Frame.AnimationFrame>=Clip->FrameCount||Time>=Clip->Duration||Duration<=0)return Fail(TEXT("Frame references invalid animation timing."));}else if(Frame.AnimationFrame!=0||Time!=0)return Fail(TEXT("Invalid static frame."));
        const FString Key=FString::Printf(TEXT("%.3f|%s|%d"),Angle,*Animation,Frame.AnimationFrame);if(Keys.Contains(Key))return Fail(TEXT("Duplicate direction/animation frame."));Keys.Add(Key);
        Frame.UVOrigin=FVector2D(static_cast<double>(Frame.PixelOrigin.X)/Out.AtlasSize.X,static_cast<double>(Frame.PixelOrigin.Y)/Out.AtlasSize.Y);Frame.UVSize=FVector2D(static_cast<double>(Frame.PixelSize.X)/Out.AtlasSize.X,static_cast<double>(Frame.PixelSize.Y)/Out.AtlasSize.Y);
        Out.Frames.Add(Frame);
    }
    int32 PerDirection=Out.Animations.IsEmpty()?1:0;for(const auto& Pair:Out.Animations)PerDirection+=Pair.Value.FrameCount;
    if(Out.Frames.Num()!=PerDirection*Out.Directions.Num())return Fail(TEXT("Incomplete directional frame set."));
    return true;
}
