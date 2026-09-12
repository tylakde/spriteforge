"""Run in UnrealEditor-Cmd with PythonScriptPlugin after importing ForgeKnight.character.json."""
import unreal
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
asset = unreal.load_asset('/Game/SpriteForge/Characters/ForgeKnight/DA_ForgeKnight_Character')
assert asset is not None, 'Character data asset missing'
states = asset.get_editor_property('states')
assert len(states) == 7
actor_class = unreal.load_class(None, '/Script/SpriteForgeRuntime.SpriteForgeImpostorActor')
example_class = unreal.load_class(None, '/Script/SpriteForgeRuntime.SpriteForgeCharacterExample')
assert example_class is not None
actor = actors.spawn_actor_from_class(actor_class, unreal.Vector(0, 0, 0))
try:
    actor.set_editor_property('character_asset', asset)
    actor.rebuild()
    assert str(actor.get_editor_property('current_state')) == 'Idle'
    for state in ('Idle', 'Walk', 'Run', 'Attack', 'Hit', 'Death'):
        assert actor.set_state(state, True)
        sprite = actor.get_editor_property('sprite_asset')
        assert sprite is not None and sprite.get_editor_property('atlas') is not None
        actor.advance_playback(0.26)
        actor.update_for_camera(unreal.Vector(0, 1000, 0))
        index = actor.get_editor_property('current_frame')
        frame = sprite.get_editor_property('frames')[index]
        assert frame.get_editor_property('animation_frame') == 1, state
        assert frame.get_editor_property('direction_degrees') == 90, state
    assert actor.play_one_shot('Attack')
    actor.advance_playback(1.1)
    assert str(actor.get_editor_property('current_state')) == 'Idle'
    assert actor.play_one_shot('Death')
    actor.advance_playback(5)
    actor.update_for_camera(unreal.Vector(1000, 0, 0))
    assert str(actor.get_editor_property('current_state')) == 'Death'
    sprite = actor.get_editor_property('sprite_asset')
    frame = sprite.get_editor_property('frames')[actor.get_editor_property('current_frame')]
    assert frame.get_editor_property('animation_frame') == 3, 'Death holds its final frame'
    assert actor.set_state('Walk', True)
    actor.advance_playback(1.26)
    actor.update_for_camera(unreal.Vector(1000, 0, 0))
    sprite = actor.get_editor_property('sprite_asset')
    frame = sprite.get_editor_property('frames')[actor.get_editor_property('current_frame')]
    assert frame.get_editor_property('animation_frame') == 1, 'Walk loops'
    actor.set_actor_rotation(unreal.Rotator(pitch=0, yaw=90, roll=0), False)
    actor.update_for_camera(unreal.Vector(1000, 0, 0))
    frame = sprite.get_editor_property('frames')[actor.get_editor_property('current_frame')]
    assert frame.get_editor_property('direction_degrees') == 270, 'Camera-relative heading'
    assert not actor.set_state('Missing', True)
    assert not actor.play_one_shot('Walk')
finally:
    actors.destroy_actor(actor)
example = actors.spawn_actor_from_class(example_class, unreal.Vector(0, 0, 0))
try:
    example.set_editor_property('character_asset', asset)
    example.rebuild()
    assert example.get_editor_property('demo_camera') is not None
    assert example.get_editor_property('quad').get_material(0) is not None
finally:
    actors.destroy_actor(example)
unreal.log('SPRITEFORGE_CHARACTER_RUNTIME_OK: all states, frame advancement, one-shot return, held death, loop, camera-relative direction and demo actor construction verified')
