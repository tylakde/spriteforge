"""Run after importing docs/examples/styles with the updated SpriteForge Editor plugin."""
import json
import unreal
pivots=[]
for name,style,filtering in [
    ('Runestone_Pixel_Fantasy','pixel',unreal.TextureFilter.TF_NEAREST),
    ('Runestone_Painted_Cartoon','cartoon',unreal.TextureFilter.TF_BILINEAR),
    ('Runestone_Pixel_Realism','hybrid',unreal.TextureFilter.TF_NEAREST),
]:
    asset=unreal.load_asset(f'/Game/SpriteForge/{name}/DA_{name}_SpriteForge')
    assert asset is not None, f'Missing style asset: {name}'
    atlas=asset.get_editor_property('atlas')
    assert atlas.get_editor_property('filter')==filtering, f'Incorrect sampling for {style}'
    assert len(asset.get_editor_property('frames'))==8
    recipe=json.loads(asset.get_editor_property('recipe_json'))
    assert recipe['style']==style
    pivots.append(asset.get_editor_property('pivot').y)
    unreal.log(f'SPRITEFORGE_STYLE: {name}, filter={atlas.get_editor_property("filter")}, 8 frames')
assert max(pivots)-min(pivots)<0.000001
assert unreal.load_asset('/Game/SpriteForge/Runestone/DA_Runestone_SpriteForge') is not None
unreal.log('SPRITEFORGE_STYLES_OK: independent assets, nearest/bilinear filtering, saved recipes and matching pivots verified')
