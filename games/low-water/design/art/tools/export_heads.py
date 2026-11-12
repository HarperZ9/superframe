"""Write design/art/heads.json: the per-person head, neck and collar sheet in metres (head-local:
+y up, +z the way the face looks). The character forge reads the same keys."""
import json
import cast
from anatomy import HEAD_DEFAULT

NECK_COLLAR = {
    'keel': dict(visible_neck_m=0.0, collar='standing collar, 0.17 m high, buttoned to the throat; the chin rests on it',
                 note='Keel has no visible neck. A long thin neck is wrong for him: the height is in the coat and the egg of the head.'),
    'lamb': dict(visible_neck_m=0.10, collar='white wing collar, 0.06 m high, open; neck radius 0.036 m',
                 note='Lamb is the long-necked one: the neck shows between collar and jaw and leans forward with the stoop.'),
    'sabine': dict(visible_neck_m=0.0, collar='shawl crossed at the throat; neck radius 0.055 m',
                   note='Sabine has no visible neck: the head sits down in the shoulders, chin on the shawl.'),
}

if __name__ == '__main__':
    out = {'units': 'metres, head-local frame', 'defaults': HEAD_DEFAULT, 'people': {}}
    for who, h in cast.HEADS.items():
        out['people'][who] = dict(head=h, **NECK_COLLAR[who])
    with open('../heads.json', 'w', encoding='utf8') as f:
        json.dump(out, f, indent=1, default=list)
    print('wrote ../heads.json')
