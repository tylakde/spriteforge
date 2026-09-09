#pragma once
#include "CoreMinimal.h"
#include "Commandlets/Commandlet.h"
#include "SpriteForgeImportCommandlet.generated.h"
UCLASS()
class USpriteForgeImportCommandlet : public UCommandlet {
    GENERATED_BODY()
public:
    USpriteForgeImportCommandlet();
    virtual int32 Main(const FString& Params) override;
};
