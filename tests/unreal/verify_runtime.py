"""Run with UnrealEditor-Cmd -run=pythonscript -script=<this file> -nullrhi.
Requires the imported Runestone and Sentinel fixtures, SpriteForgeImporter and PythonScriptPlugin.
"""
import unreal

actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
actor_class = unreal.load_class(None, '/Script/SpriteForgeRuntime.SpriteForgeImpostorActor')
assert actor_class is not None, 'Runtime actor class must be available'
material = unreal.load_asset('/Game/SpriteForge/_Shared/M_SpriteForge_Masked')
assert material is not None
assert unreal.MaterialEditingLibrary.get_material_property_input_node(material, unreal.MaterialProperty.MP_EMISSIVE_COLOR) is not None
assert unreal.MaterialEditingLibrary.get_material_property_input_node(material, unreal.MaterialProperty.MP_OPACITY_MASK) is not None

for name in ('Runestone', 'Sentinel'):
    asset = unreal.load_asset(f'/Game/SpriteForge/{name}/DA_{name}_SpriteForge')
    assert asset is not None, f'{name} data asset missing'
    actor = actors.spawn_actor_from_class(actor_class, unreal.Vector(0, 0, 0))
    try:
        actor.set_editor_property('sprite_asset', asset)
        actor.rebuild()
        quad = actor.get_editor_property('quad')
        assert quad.get_material(0) is not None, 'Runtime material must be assigned'
        frames = asset.get_editor_property('frames')
        for yaw, camera in ((0, (1000, 0, 0)), (90, (0, 1000, 0)), (180, (-1000, 0, 0)), (270, (0, -1000, 0))):
            actor.update_for_camera(unreal.Vector(*camera))
            index = actor.get_editor_property('current_frame')
            assert index >= 0
            angle = frames[index].get_editor_property('direction_degrees')
            assert abs((angle-yaw+180) % 360-180) < 0.01, (name, yaw, angle)
            assert abs(actor.get_actor_rotation().yaw) < 0.01, 'Billboarding must not rotate logical heading'
            assert abs((quad.get_world_rotation().yaw-yaw+180) % 360-180) < 0.01
            assert abs(actor.get_actor_location().z) < 0.01, 'Ground anchor must remain fixed'
        actor.set_actor_rotation(unreal.Rotator(pitch=0, yaw=90, roll=0), False)
        assert abs(actor.get_actor_rotation().yaw-90) < 0.01, str(actor.get_actor_rotation())
        actor.update_for_camera(unreal.Vector(1000, 0, 0))
        frame = frames[actor.get_editor_property('current_frame')]
        assert abs(frame.get_editor_property('direction_degrees')-270) < 0.01, 'Actor heading must offset direction selection'
        if name == 'Sentinel':
            i0 = asset.find_frame(0, 'Idle', 0)
            i1 = asset.find_frame(0, 'Idle', 0.2)
            assert frames[i0].get_editor_property('animation_frame') == 0
            assert frames[i1].get_editor_property('animation_frame') == 1
            assert asset.find_frame(0, 'Idle', 1.0) == i0, 'Animation must loop deterministically'
    finally:
        actors.destroy_actor(actor)
unreal.log('SPRITEFORGE_RUNTIME_OK: actor construction, materials, camera quadrants, heading offset, ground placement and animated frame selection verified')
