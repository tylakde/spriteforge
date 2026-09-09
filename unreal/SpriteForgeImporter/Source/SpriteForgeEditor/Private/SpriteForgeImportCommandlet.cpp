#include "SpriteForgeImportCommandlet.h"
#include "SpriteForgeImportService.h"
#include "SpriteForgeAsset.h"
#include "SpriteForgeMetadata.h"
#include "Misc/Parse.h"
USpriteForgeImportCommandlet::USpriteForgeImportCommandlet(){IsClient=false;IsServer=false;IsEditor=true;LogToConsole=true;}
int32 USpriteForgeImportCommandlet::Main(const FString& Params){
    FString Metadata,Atlas,Error;
    if(!FParse::Value(*Params,TEXT("Metadata="),Metadata)){UE_LOG(LogTemp,Error,TEXT("Pass -Metadata=<SpriteForge.json>"));return 1;}
    FParse::Value(*Params,TEXT("Atlas="),Atlas);
    USpriteForgeAsset* Asset=SpriteForgeImportService::Import(Metadata,Atlas,Error);
    if(!Asset){UE_LOG(LogTemp,Error,TEXT("SpriteForge: %s"),*Error);return 1;}
    // Exercise runtime selection against actual imported data, including wraparound and front offset.
    for(int32 i=0;i<Asset->Directions.Num();i++){
        const float Yaw=Asset->Directions[i]-Asset->FrontDirection;
        const int32 Index=Asset->FindFrame(Yaw+720,NAME_None,0);
        if(!Asset->Frames.IsValidIndex(Index)||FMath::Abs(FMath::FindDeltaAngleDegrees(Asset->Frames[Index].DirectionDegrees,Asset->Directions[i]))>0.01f){UE_LOG(LogTemp,Error,TEXT("SpriteForge direction selection validation failed."));return 2;}
    }
    FSpriteForgeDocument Invalid;if(SpriteForgeMetadata::Parse(TEXT("{\"version\":2}"),Invalid,Error)){UE_LOG(LogTemp,Error,TEXT("Invalid schema was accepted."));return 3;}
    UE_LOG(LogTemp,Display,TEXT("SPRITEFORGE_IMPORT_OK: %s, %d frames, texture + material + data asset saved; direction selection verified."),*Asset->GetPathName(),Asset->Frames.Num());return 0;
}
