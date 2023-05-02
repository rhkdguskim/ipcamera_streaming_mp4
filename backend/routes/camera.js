const ffmpeg = require('fluent-ffmpeg');
const ffmpeg_static = require('ffmpeg-static');
var express = require("express");
const expressWs = require("express-ws");
const Datastore = require('nedb');
const router = express.Router();
const cam = require("../classes/camera");
const db = new Datastore({ filename: 'db/CameraDB', autoload: true });
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

expressWs(router);
const MycameraList = new Map();



// db.on('insert', (newDoc) => {
//     console.log('insert event occurred:', newDoc);
//     const { _id, ...rest } = newDoc;
//     const id = _id.toString();
//     db.update({ _id }, { $set: { ...rest, id } });
//   });

db.find({}, (err, cameras) => {
    if(err)
    {
        console.log("error");
    }
    else
    {
        for(idx in cameras)
        {
            const Camera = new cam(cameras[idx].camname, cameras[idx].ip, cameras[idx].port, cameras[idx].username, cameras[idx].password, cameras[idx].id);
            Camera.SetLiveProfile(cameras[idx].liveprofile);
            Camera.SetProtocolType(cameras[idx].protocoltype);
            Camera.start();
            MycameraList.set(cameras[idx].id, Camera);
        }
    }
})

router.ws('/ws/:id/:profile', (ws, req) => {
    const camid = req.params.id;
    const profile = req.params.profile;
    console.log("websocketStreaming");
    //console.log(profile);

    const camera = MycameraList.get(camid);

    if (!camera) {
        console.error(`Camera ${camid} not found`);
        return;
      }

    camera.getFFmpegStream(profile);
    const stream = camera.ffmpegStreams.get(profile);

    stream.on('data', (data) => {
      ws.send(data);
    });

    stream.on('end', () => {
        console.log("Streaming ended");
        ws.close();
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });

    ws.on('message', (data) => {
        console.log(data);
    })
  });

router.post('/', (req, res) => {
    console.log(req.body)
    const id = uuidv4();
    const camera = {
        id:id,
        camname:req.body.camname,
        ip:req.body.ip,
        port:req.body.port,
        username:req.body.username,
        password:req.body.password,
        liveprofile:req.body.liveprofile || "noprofile",
        protocoltype:req.body.protocoltype || "mp4",
        profile:[],
    };
    db.insert(camera, (err, result) => {
        if (err) {
            res.status(500).send(err.message);
        }
        else {
            const Camera = new cam(req.body.camname, req.body.ip, req.body.port , req.body.username, req.body.password, id);
            Camera.SetLiveProfile(req.body.liveprofile);
            Camera.SetProtocolType(req.body.protocoltype);
            Camera.start();
            MycameraList.set(id, Camera);
            res.status(201).send(result);
        }
    })
});

router.post('/profile', (req, res) => {
    const Camera = new cam("fake", req.body.ip, req.body.port , "fake", "fake");
    Camera.connect();

    Camera.Emitter.on("offline", () =>
    {
        res.send({Isonline:false});
    })

    Camera.Emitter.on("profile", (profiles) =>
    {
        res.send({Isonline:true, profiles});
    })

});

router.get('/profile/:id', (req, res) => {
    const Camera = MycameraList.get(req.params.id);
    //console.log(Camera.profilelist);
    res.send(Camera.profilelist);
});

router.get('/', (req, res) => {
    db.find({}, (err, cameras) => {
        if (err) {
            res.status(500).send(err.message);
        }
        else{
            res.status(201).send(cameras);
        }
    })
});

router.get('/hls/:id/', (req, res) => {
    const m3u8FilePath = path.join(__dirname, `../hls/${req.params.id}`, 'play.m3u8');
    //console.log(m3u8FilePath);

    console.log(`${req.params.id}/play.m3u8`);
    res.redirect(`../../../${req.params.id}/play.m3u8`);
    // const stream = fs.createReadStream(m3u8FilePath);
    // stream.on('error', (err) => {
    //   console.error(err);
    //   res.status(500).end('Internal Server Error');
    // });
    // res.set('Content-Type', 'application/vnd.apple.mpegurl');
    // stream.pipe(res);
})

router.get('/:id/', (req, res) => {

    const camid = req.params.id;

     const camera = MycameraList.get(camid);
     console.log(camera.liveprofile);
     console.log(camera.rtspurl.get(camera.liveprofile));

    res.setHeader('Connection', 'Keep-Alive');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Transfer-Encoding', 'chunked');

    const args = [
        '-i',
        `${camera.rtspurl.get(camera.liveprofile)}`, //`${camera.rtspurl.get(camera.liveprofile)}`
        '-vcodec',
        'copy',
        '-f',
        'mp4',
        `-preset`, `ultrafast`,
        `-tune`, `zerolatency`,
        '-movflags',
        'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1',
      ];
      
      const proc = spawn(ffmpeg_static, args);
      
      proc.stdout.on('data', (data) => {
        res.write(data);
      });

    req.on('close', () => {
        proc.kill();
        console.log('Client disconnected');
    });
});

router.delete('/', (req,res) => {
    db.remove({_id:req.body.id}, {}, (err, numRemoved) => {
        if(err) {
            res.status(500).send(err.message);
        }
        else{
            MycameraList.delete(req.body.id);
            res.status(201).send(numRemoved.toString());
        }
    })
});

router.put('/', (req,res) => {
    
    console.log(req.body);

    const Camera = MycameraList.get(req.body.id);
    Camera.SetLiveProfile(req.body.liveprofile);
    Camera.SetProtocolType(req.body.protocoltype);
    db.findOne({ id: req.body.id }, function (err, doc) {
        console.log(doc);

        db.update({ id:req.body.id}, { $set: req.body } , {} , (err, numRemoved) => {
            if(err) {
                console.log(err.message);
                res.status(500).send(err.message);
            }
            else{
                res.status(201).send(numRemoved.toString());
            }
        })
    })
    
});

module.exports = router;