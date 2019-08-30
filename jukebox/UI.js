const Casque = require("./casque/Casque");
const electron = require('electron');
const win = electron.remote.getCurrentWindow();
const fs = require("fs");
const ContenuModel = require("./contenu/ContenuModel");
const remote = electron.remote;
/**
 * L'interface utilisateur
 * @type {Electron}
 */
class UI{
    constructor(){
        let me=this;
        //injecte les icones svg
        let $svg=this.$template("jukebox/svg-collection/jukebox.svg");
        $body.append($svg);

        //injecte la nav
        let $nav=this.$template("jukebox/nav.html");
        $body.prepend($nav);



        $nav.on("click",".js-close-app",function(){
           me.exitApp();
        });


        $nav.on("click",".js-close-delete",function(){
            var btns = ['annuler']
            for (let deviceId in Casque.configJson.casques) {
                if (!Casque.configJson.casques.hasOwnProperty(deviceId)) continue;
                btns.push(Casque.configJson.casques[deviceId].identifier);
            }
            const dialog = require('electron').remote.dialog;
            const options = {
                type: 'question',
                buttons: btns,
                defaultId: 5,
                title: 'Question',
                message: 'quel casque voulez vous supprimer ?'
            };

            dialog.showMessageBox(null, options, (response) =>
            {

                if (response === 0) {
                    return null;
                }
                else {
                    var DeviceId =  Casque.getCasqueByIdentifier(btns[response]).deviceId ;
                    var msg = "êtes vous sur de vouloir supprimer "+DeviceId+" ?";
                    const dialog = require('electron').remote.dialog;
                    const options = {
                        type: 'question',
                        buttons: ["oui","non"],
                        defaultId: 1,
                        title: 'Question',
                        message: msg
                    };
                    dialog.showMessageBox(null, options, (response) => {
                        if (response === 1) {
                            return null;
                        }
                        else {

                            console.warn( "deleteing casque");
                            Casque.deleteCasqueById(DeviceId);


                        }
                    }); // end dialog 2
                }


            }); // end dialog 1
        });

        //charge le catalogue
        this.chargeCatalogueOnline();
        //initialise les écouteurs
        this._initDomListeners();
        /**
         * Conteneur des contenus
         */
        this.$contenus=$body.find("#contenus");
        /**
         * Conteneur des casques
         */
        this.$casques=$body.find("#casques");
        /**
         * Le logo
         */
        this.$logo=$body.find("#logo");

        /**
         * Element html où sont inscrites les logs
         * @type {*|jQuery|HTMLElement}
         */
        this.$logs=$("#logs");
        this.$logLine=$("#logline");

        this.$navOnline=$('[data-nav-screen="online"]');
        this.$navSync=$('.js-sync');


        //injecte le menu actions
        /**
         * Le menu qui contient play/pause all
         * @type {*|jQuery|HTMLElement}
         * @private
         */
        this._actionsMenu=this.$template("jukebox/actions-menu.html");
        $("[data-screen='local']").append(this._actionsMenu);

        let $btnPlay=this._actionsMenu.find("[data-action='play']");
        let $btnPause=this._actionsMenu.find("[data-action='pause']");
        $btnPause.on("click",function(){
            Casque.pauseAllSelected();
        });
        $btnPlay.on("click",function(){
            let duration=$(this).attr("data-duration");
            Casque.playAllSelected(duration);
        });

    }

    /**
     * Active ou désactive le menu d'action
     * @param {boolean} active si false désactiveera
     */
    activeActionMenu(active=true){
        if(active){
            this._actionsMenu.addClass("active");
        }else{
            this._actionsMenu.removeClass("active");
        }
    }

    /**
     * Met à jour les contenus
     * @param {array} contenus
     */
    updateContenus(contenus){
        this.$contenus.empty();
        for(let contenu of contenus){
            this.addContenu(contenu);
        }
    }

    /**
     * Charge le logo
     * @param url
     */
    setLogo(url){
        this.$logo.css("background-image","url('"+this.base64_encode(url)+"')");
    }






    /**
     * @private
     * @param data
     */
    addContenu(data){
        let contenu=new ContenuModel(data);
        this.$contenus.append(contenu.$display());
    }

    /**
     *
     * @param {Casque} casque
     */
    addCasque(casque){
        this.$casques.append(casque.$el);
    }

    setOnline(online){
        if(online){
            this.$navOnline.removeClass("d-none");
            this.$navSync.removeClass("text-danger");
            this.chargeCatalogueOnline();
        }else{
            this.$navSync.addClass("text-danger");
            this.$navOnline.addClass("d-none");
            this.chargeCatalogueOnline();
        }
    }


    /**
     * Pour charger un template html
     * @param {string} htmlFilePath Chemin vers le fichier html
     * @return {*|jQuery|HTMLElement}
     */
    $template(htmlFilePath){
        let template = fs.readFileSync(htmlFilePath,{encoding: 'utf-8'});
        return $(template);
    }

    /**
     * Pour charger une image statique
     * @param {string} imgUrl
     * @param {*|jQuery|HTMLElement} $img
     */
    setImgSrc(imgUrl,$img){
        $img.attr("src",this.base64_encode(imgUrl));
    }

    /**
     * Retourne l'url base 64 d'une image
     * @private
     * @param file
     * @return {string}
     */
    base64_encode(file) {
        let imgPath = file;
        // read binary data
        var bitmap = fs.readFileSync(imgPath);
        // convert binary data to base64 encoded string
        let buff= Buffer.from(bitmap).toString('base64');
        return "data:image/png;base64,"+buff;
    }

    /**
     * Affiche l'écran spécifié
     * @param screenName
     */
    goScreen(screenName){
        $("[data-screen]").removeClass("active");
        this.$screen(screenName).addClass("active");
        $("[data-nav-screen]").parent().removeClass("active");
        $("[data-nav-screen='"+screenName+"']").parent().addClass("active");
        if(screenName==="online"){
            this.chargeCatalogueOnline();
        }
    }

    /**
     * Renvoie le nom de l'écran courrant
     * @return {string}
     */
    getCurrentScreen(){
        return $("[data-screen].active").attr("data-screen");
    }

    /**
     *
     * @param {string} screenName
     * @return {*|jQuery|HTMLElement}
     */
    $screen(screenName){
        return $("[data-screen='"+screenName+"']");
    }

    chargeCatalogueOnline(){
        let $iframe=this.$screen("online").find("iframe");
        $iframe.attr("src",window.webServer.urlCatalogueOnline);
        if($iframe.attr("src")==="webserveur.urlCatalogueOnline"){

        }else{

        }

    }

    /**
     * Initialise les écouteurs sur le dom
     * @private
     */
    _initDomListeners(){
        let me =this;

        $(".js-toggle-fs").on("click",function(e){
            UI.toggleFS();
        });
        $("[data-nav-screen]").on("click",function(e){
            me.goScreen($(this).attr("data-nav-screen"));
        });

    }
    /**
     * Entre ou sort du full screen
     */
    static toggleFS(){
        win.setFullScreen(!win.isFullScreen());
        win.setMenuBarVisibility(!win.isFullScreen());
    }

    logLine(message){
        this.$logLine.text(message);
    }

    /**
     * Ferme le programme
     */
    exitApp() {
        remote.getCurrentWindow().close();
    }
}
module.exports = UI;




